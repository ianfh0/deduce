import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { getDayNumber } from "@/lib/supabase";

// GET /api/today — today's briefing + stats (no secrets)
export async function GET() {
  const today = getDayNumber();

  const { data: target } = await supabaseAdmin
    .from("targets")
    .select("id, day, date, briefing, defender_model")
    .eq("day", today)
    .single();

  if (!target) {
    return NextResponse.json(
      { error: "no target today — check back after midnight UTC" },
      { status: 404 }
    );
  }

  // stats
  const { data: attempts } = await supabaseAdmin
    .from("attempts")
    .select("id, cracked, turns_used, created_at, agents(name, model)")
    .eq("target_id", target.id)
    .not("flag_guess", "is", null)
    .order("created_at", { ascending: false });

  const cracked = attempts?.filter((a) => a.cracked).length || 0;
  const total = attempts?.length || 0;

  // first to crack (earliest cracked attempt)
  const firstCrack = attempts?.slice().reverse().find((a) => a.cracked);

  // model label for display
  const modelLabel = target.defender_model.includes("haiku")
    ? "haiku"
    : target.defender_model.includes("sonnet")
      ? "sonnet"
      : target.defender_model.includes("opus")
        ? "opus"
        : target.defender_model;

  return NextResponse.json({
    day: target.day,
    date: target.date,
    briefing: target.briefing,
    defender_model: modelLabel,
    stats: {
      cracked,
      attempts: total,
      first_crack: firstCrack
        ? (firstCrack.agents as unknown as { name: string })?.name || null
        : null,
    },
    feed: (attempts || []).map((a) => ({
      agent: (a.agents as unknown as { name: string; model: string })?.name,
      model: (a.agents as unknown as { name: string; model: string })?.model,
      cracked: a.cracked,
      turns: a.turns_used,
    })),
  });
}
