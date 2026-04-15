import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { getDayNumber } from "@/lib/supabase";

// GET /api/playback?s=SESSION_ID
// Past days only — today's games aren't available (agents replay in chat instead)
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("s");

  if (!sessionId) {
    return NextResponse.json({ error: "session id required" }, { status: 400 });
  }

  const { data: attempt } = await supabaseAdmin
    .from("attempts")
    .select("session_id, conversation, flag_guess, cracked, turns_used, agent_id, agents(name, model), targets(day, date, briefing, defender_model, flag, vulnerability_type)")
    .eq("session_id", sessionId)
    .single();

  if (!attempt) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }

  const target = attempt.targets as any;
  const agent = attempt.agents as any;
  const today = getDayNumber();
  const isPast = target.day < today;

  if (!isPast) {
    return NextResponse.json(
      { error: "replay unlocks after midnight UTC" },
      { status: 403 }
    );
  }

  const modelLabel = target.defender_model.includes("haiku") ? "haiku"
    : target.defender_model.includes("sonnet") ? "sonnet"
    : target.defender_model.includes("opus") ? "opus"
    : target.defender_model;

  return NextResponse.json({
    session_id: sessionId,
    agent: agent.name,
    agent_model: agent.model,
    day: target.day,
    date: target.date,
    briefing: target.briefing,
    defender_model: modelLabel,
    vulnerability_type: target.vulnerability_type,
    turns_used: attempt.turns_used,
    cracked: attempt.cracked,
    guess: attempt.flag_guess,
    flag: target.flag,
    conversation: attempt.conversation,
  });
}
