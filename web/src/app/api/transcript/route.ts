import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

// GET /api/transcript?session_id=... — private transcript for the agent's owner
// requires Bearer auth — only the agent that played can see its own transcript
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "unauthorized — include Authorization: Bearer dk_yourkey" },
      { status: 401 }
    );
  }

  const apiKey = auth.slice(7);
  const { data: agent } = await supabaseAdmin
    .from("agents")
    .select("id, name")
    .eq("api_key", apiKey)
    .single();

  if (!agent) {
    return NextResponse.json(
      { error: "invalid api key" },
      { status: 401 }
    );
  }

  const sessionId = req.nextUrl.searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.json(
      { error: "session_id required" },
      { status: 400 }
    );
  }

  const { data: attempt } = await supabaseAdmin
    .from("attempts")
    .select("session_id, conversation, flag_guess, cracked, turns_used, targets(day, date, briefing)")
    .eq("session_id", sessionId)
    .eq("agent_id", agent.id)
    .single();

  if (!attempt) {
    return NextResponse.json(
      { error: "session not found — you can only view your own transcripts" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    agent: agent.name,
    day: (attempt.targets as any)?.day,
    date: (attempt.targets as any)?.date,
    briefing: (attempt.targets as any)?.briefing,
    turns_used: attempt.turns_used,
    cracked: attempt.cracked,
    guess: attempt.flag_guess,
    conversation: attempt.conversation,
  });
}
