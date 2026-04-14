import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { getDayNumber } from "@/lib/supabase";
import { callDefender, buildMessages } from "@/lib/defender";
import type { ConversationTurn } from "@/lib/types";
import { getIP, checkRateLimit } from "@/lib/rate-limit";

const MAX_TURNS = 5;

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

// POST /api/play — send a message, get defender reply
export async function POST(req: NextRequest) {
  try {
    // rate limit: 30 play calls per IP per hour (6 agents × 5 turns)
    const ip = getIP(req);
    const { allowed, retryAfterSeconds } = await checkRateLimit(ip, "play", 30, 3600);
    if (!allowed) {
      return NextResponse.json(
        { error: `rate limited — too many play requests. try again in ${retryAfterSeconds}s.` },
        { status: 429 }
      );
    }

    const agent = await authenticate(req);
    if (!agent) {
      return NextResponse.json(
        { error: "unauthorized — include Authorization: Bearer dk_yourkey" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { message, session_id } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "message required" },
        { status: 400 }
      );
    }

    if (message.length > 2000) {
      return NextResponse.json(
        { error: "message too long — 2000 chars max" },
        { status: 400 }
      );
    }

    const today = getDayNumber();

    // get today's target
    const { data: target } = await supabaseAdmin
      .from("targets")
      .select("*")
      .eq("day", today)
      .single();

    if (!target) {
      return NextResponse.json(
        { error: "no target today — check back after midnight UTC" },
        { status: 404 }
      );
    }

    // get or create attempt
    let attempt;

    if (session_id) {
      // continue existing session
      const { data } = await supabaseAdmin
        .from("attempts")
        .select("*")
        .eq("session_id", session_id)
        .eq("agent_id", agent.id)
        .single();

      if (!data) {
        return NextResponse.json(
          { error: "session not found" },
          { status: 404 }
        );
      }

      if (data.flag_guess) {
        return NextResponse.json(
          { error: "session ended — you already guessed" },
          { status: 409 }
        );
      }

      attempt = data;
    } else {
      // check if already played today
      const { data: existing } = await supabaseAdmin
        .from("attempts")
        .select("id, cracked, flag_guess")
        .eq("target_id", target.id)
        .eq("agent_id", agent.id)
        .limit(1);

      if (existing && existing.length > 0) {
        return NextResponse.json(
          { error: "already played today — come back tomorrow" },
          { status: 409 }
        );
      }

      // create new attempt
      const newSessionId = crypto.randomUUID();
      const { data: newAttempt, error } = await supabaseAdmin
        .from("attempts")
        .insert({
          target_id: target.id,
          agent_id: agent.id,
          session_id: newSessionId,
          conversation: [],
          cracked: false,
          turns_used: 0,
        })
        .select("*")
        .single();

      if (error || !newAttempt) {
        return NextResponse.json(
          { error: "failed to create session" },
          { status: 500 }
        );
      }

      attempt = newAttempt;
    }

    // check turn limit
    const conversation: ConversationTurn[] = attempt.conversation || [];
    const turnsUsed = conversation.filter(
      (t: ConversationTurn) => t.role === "attacker"
    ).length;

    if (turnsUsed >= MAX_TURNS) {
      return NextResponse.json(
        {
          error: "no turns left — submit your guess with POST /api/guess",
          turns_used: turnsUsed,
          session_id: attempt.session_id,
        },
        { status: 400 }
      );
    }

    // add attacker message
    const turnNumber = turnsUsed + 1;
    conversation.push({
      role: "attacker",
      content: message,
      turn: turnNumber,
    });

    // call defender
    const defenderReply = await callDefender(
      target.defender_prompt,
      target.defender_model,
      buildMessages(conversation)
    );

    // add defender reply
    conversation.push({
      role: "defender",
      content: defenderReply,
      turn: turnNumber,
    });

    // update attempt
    await supabaseAdmin
      .from("attempts")
      .update({
        conversation,
        turns_used: turnNumber,
      })
      .eq("id", attempt.id);

    return NextResponse.json({
      session_id: attempt.session_id,
      reply: defenderReply,
      turn: turnNumber,
      turns_remaining: MAX_TURNS - turnNumber,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "something went wrong", detail: String(e) },
      { status: 500 }
    );
  }
}

// GET /api/play — legacy compat, redirect to /api/today
export async function GET() {
  return NextResponse.json({
    message: "use GET /api/today for today's briefing",
  });
}
