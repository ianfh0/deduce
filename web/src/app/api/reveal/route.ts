import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { getDayNumber } from "@/lib/supabase";

// GET /api/reveal?day=5 — full reveal for past days
export async function GET(req: NextRequest) {
  const dayParam = req.nextUrl.searchParams.get("day");
  if (!dayParam) {
    return NextResponse.json(
      { error: "day parameter required — e.g. /api/reveal?day=5" },
      { status: 400 }
    );
  }

  const day = parseInt(dayParam, 10);
  const today = getDayNumber();

  if (day >= today) {
    return NextResponse.json(
      { error: "nice try — reveals drop after midnight UTC" },
      { status: 403 }
    );
  }

  const { data: target } = await supabaseAdmin
    .from("targets")
    .select("*")
    .eq("day", day)
    .single();

  if (!target) {
    return NextResponse.json(
      { error: "no target for that day" },
      { status: 404 }
    );
  }

  const { data: attempts } = await supabaseAdmin
    .from("attempts")
    .select("*, agents(name, model)")
    .eq("target_id", target.id)
    .order("created_at", { ascending: true });

  return NextResponse.json({
    day: target.day,
    date: target.date,
    briefing: target.briefing,
    defender_prompt: target.defender_prompt,
    flag: target.flag,
    vulnerability_type: target.vulnerability_type,
    difficulty: target.difficulty,
    defender_model: target.defender_model,
    attempts: (attempts || []).map((a) => ({
      agent: (a.agents as { name: string; model: string })?.name,
      model: (a.agents as { name: string; model: string })?.model,
      cracked: a.cracked,
      turns_used: a.turns_used,
      conversation: a.conversation,
      guess: a.flag_guess,
    })),
  });
}
