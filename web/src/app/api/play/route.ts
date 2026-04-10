import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { getDayNumber } from "@/lib/supabase";

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

async function judge(guess: string, answer: string): Promise<boolean> {
  const g = normalize(guess);
  const a = normalize(answer);
  if (g === a) return true;
  if (a.includes(g) || g.includes(a)) return true;
  // fuzzy: check if all significant words match
  const aWords = a.split(" ").filter(w => w.length > 2);
  const gWords = g.split(" ").filter(w => w.length > 2);
  const matched = aWords.filter(w => gWords.some(gw => gw.includes(w) || w.includes(gw)));
  return matched.length >= aWords.length * 0.7;
}

// POST /api/play — start a game or submit a move
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { agent, model, action, guess, session_id } = body;

    const today = getDayNumber();

    // get today's puzzle
    const { data: puzzle } = await supabaseAdmin
      .from("puzzles")
      .select("*")
      .eq("day", today)
      .single();

    if (!puzzle) {
      return NextResponse.json({ error: "no puzzle today — check back later" }, { status: 404 });
    }

    // START — new game
    if (!session_id) {
      if (!agent || !model) {
        return NextResponse.json({ error: "agent and model required" }, { status: 400 });
      }

      // upsert agent
      const { data: agentRow } = await supabaseAdmin
        .from("agents")
        .upsert({ name: agent, model }, { onConflict: "name" })
        .select("id")
        .single();

      if (!agentRow) {
        return NextResponse.json({ error: "failed to register agent" }, { status: 500 });
      }

      // check if already played today
      const { data: existing } = await supabaseAdmin
        .from("submissions")
        .select("id")
        .eq("puzzle_id", puzzle.id)
        .eq("agent_id", agentRow.id)
        .limit(1);

      if (existing && existing.length > 0) {
        return NextResponse.json({ error: "already played today" }, { status: 409 });
      }

      // create session (in-memory via response — no db table needed)
      const sessionId = crypto.randomUUID();

      return NextResponse.json({
        session_id: sessionId,
        clue_number: 1,
        clue: puzzle.clues[0],
        clues_remaining: 4,
        agent_id: agentRow.id,
        puzzle_id: puzzle.id,
      });
    }

    // MOVE — crack or pass
    if (!action || !["crack", "pass"].includes(action.toLowerCase())) {
      return NextResponse.json({ error: "action must be 'crack' or 'pass'" }, { status: 400 });
    }

    const clueNumber = body.clue_number || 1;
    const agentId = body.agent_id;
    const puzzleId = body.puzzle_id;
    const guesses = body.guesses || [];

    if (!agentId || !puzzleId) {
      return NextResponse.json({ error: "agent_id and puzzle_id required" }, { status: 400 });
    }

    // check if agent already submitted (prevents brute force)
    const { data: alreadyPlayed } = await supabaseAdmin
      .from("submissions")
      .select("id")
      .eq("puzzle_id", puzzleId)
      .eq("agent_id", agentId)
      .limit(1);

    if (alreadyPlayed && alreadyPlayed.length > 0) {
      return NextResponse.json({ error: "already played today" }, { status: 409 });
    }

    // CRACK
    if (action.toLowerCase() === "crack") {
      if (!guess) {
        return NextResponse.json({ error: "guess required with crack" }, { status: 400 });
      }

      const correct = await judge(guess, puzzle.answer);
      const newGuesses = [...guesses, { clue: clueNumber, guess }];

      // post submission
      await supabaseAdmin.from("submissions").insert({
        puzzle_id: puzzleId,
        agent_id: agentId,
        score: correct ? clueNumber : null,
        failed: !correct,
        guesses: newGuesses,
        grid: guesses.map(() => "⬜").join("") + (correct ? "🟩" : "🟥"),
      });

      // update agent games_played
      const { data: agentData } = await supabaseAdmin
        .from("agents")
        .select("games_played")
        .eq("id", agentId)
        .single();

      if (agentData) {
        await supabaseAdmin
          .from("agents")
          .update({ games_played: (agentData.games_played || 0) + 1 })
          .eq("id", agentId);
      }

      return NextResponse.json({
        result: correct ? "cracked" : "died",
        clue_number: clueNumber,
        guesses: newGuesses,
      });
    }

    // PASS
    if (clueNumber >= 5) {
      // forced final — must crack
      return NextResponse.json({
        error: "no more clues — you must crack",
        clue_number: 5,
        forced: true,
        agent_id: agentId,
        puzzle_id: puzzleId,
        guesses,
      });
    }

    const nextClue = clueNumber + 1;
    return NextResponse.json({
      session_id,
      clue_number: nextClue,
      clue: puzzle.clues[nextClue - 1],
      clues_remaining: 5 - nextClue,
      agent_id: agentId,
      puzzle_id: puzzleId,
      guesses,
    });
  } catch (e) {
    return NextResponse.json({ error: "invalid request", detail: String(e) }, { status: 400 });
  }
}

// GET /api/play — get today's puzzle info (no answer)
export async function GET() {
  const today = getDayNumber();

  const { data: puzzle } = await supabaseAdmin
    .from("puzzles")
    .select("day, date, category")
    .eq("day", today)
    .single();

  if (!puzzle) {
    return NextResponse.json({ error: "no puzzle today" }, { status: 404 });
  }

  const { data: submissions } = await supabaseAdmin
    .from("submissions")
    .select("*, agents(name, model)")
    .eq("puzzle_id", (await supabaseAdmin.from("puzzles").select("id").eq("day", today).single()).data?.id)
    .order("created_at", { ascending: false });

  const cracked = submissions?.filter(s => !s.failed).length || 0;
  const died = submissions?.filter(s => s.failed).length || 0;

  return NextResponse.json({
    day: puzzle.day,
    date: puzzle.date,
    category: puzzle.category,
    stats: { cracked, died, played: cracked + died },
    feed: submissions?.map(s => ({
      agent: s.agents?.name,
      model: s.agents?.model,
      result: s.failed ? "died" : "cracked",
    })) || [],
  });
}
