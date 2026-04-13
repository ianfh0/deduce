import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

// authenticate agent by api key
async function authenticate(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;

  const apiKey = auth.slice(7);
  const { data } = await supabaseAdmin
    .from("agents")
    .select("id, name")
    .eq("api_key", apiKey)
    .single();

  return data;
}

// POST /api/guess — submit your guess for the secret
export async function POST(req: NextRequest) {
  try {
    const agent = await authenticate(req);
    if (!agent) {
      return NextResponse.json(
        { error: "unauthorized" },
        { status: 401 }
      );
    }

    const { session_id, guess } = await req.json();

    if (!session_id || !guess) {
      return NextResponse.json(
        { error: "session_id and guess required" },
        { status: 400 }
      );
    }

    // get attempt
    const { data: attempt } = await supabaseAdmin
      .from("attempts")
      .select("*, targets(*)")
      .eq("session_id", session_id)
      .eq("agent_id", agent.id)
      .single();

    if (!attempt) {
      return NextResponse.json(
        { error: "session not found" },
        { status: 404 }
      );
    }

    if (attempt.flag_guess) {
      return NextResponse.json(
        { error: "already guessed this session" },
        { status: 409 }
      );
    }

    // judge guess
    const flag = attempt.targets?.flag || "";
    const correct =
      normalize(guess) === normalize(flag) ||
      normalize(flag).includes(normalize(guess)) ||
      normalize(guess).includes(normalize(flag));

    // update attempt
    await supabaseAdmin
      .from("attempts")
      .update({
        flag_guess: guess,
        cracked: correct,
      })
      .eq("id", attempt.id);

    // update agent stats
    const { data: agentData } = await supabaseAdmin
      .from("agents")
      .select("games_played, games_cracked, streak")
      .eq("id", agent.id)
      .single();

    if (agentData) {
      const updates: Record<string, number> = {
        games_played: (agentData.games_played || 0) + 1,
      };

      if (correct) {
        updates.games_cracked = (agentData.games_cracked || 0) + 1;
        updates.streak = (agentData.streak || 0) + 1;
      } else {
        updates.streak = 0;
      }

      await supabaseAdmin.from("agents").update(updates).eq("id", agent.id);
    }

    // get rank (how many cracked before you)
    let rank = 0;
    if (correct) {
      const { count } = await supabaseAdmin
        .from("attempts")
        .select("id", { count: "exact" })
        .eq("target_id", attempt.target_id)
        .eq("cracked", true);

      rank = count || 1;
    }

    // build shareable result
    const day = attempt.targets?.day || "?";
    const turns = attempt.turns_used || 0;
    const blocks = correct
      ? "🟩".repeat(turns) + "⬛".repeat(5 - turns)
      : "🟥".repeat(Math.min(turns, 5));
    const share = correct
      ? `Deduce Day ${day} 🔍\n${blocks}\nCracked in ${turns} ${turns === 1 ? "turn" : "turns"}\ndeduce.fun`
      : `Deduce Day ${day} 🔍\n${blocks}\nFailed\ndeduce.fun`;

    return NextResponse.json({
      correct,
      turns_used: attempt.turns_used,
      share,
      ...(correct
        ? { rank }
        : { message: "wrong — better luck tomorrow" }),
    });
  } catch (e) {
    return NextResponse.json(
      { error: "something went wrong", detail: String(e) },
      { status: 500 }
    );
  }
}
