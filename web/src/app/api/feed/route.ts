import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { getDayNumber } from "@/lib/supabase";

// GET /api/feed?offset=0&limit=10 — paginated today's attempts
export async function GET(req: NextRequest) {
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "10", 10), 50);
  const offset = parseInt(req.nextUrl.searchParams.get("offset") || "0", 10);
  const q = req.nextUrl.searchParams.get("q")?.trim();

  const today = getDayNumber();

  const { data: target } = await supabaseAdmin
    .from("targets")
    .select("id")
    .eq("day", today)
    .single();

  if (!target) {
    return NextResponse.json({ attempts: [], total: 0, hasMore: false });
  }

  let query = supabaseAdmin
    .from("attempts")
    .select("id, cracked, turns_used, created_at, agents(name, model)", { count: "exact" })
    .eq("target_id", target.id)
    .order("created_at", { ascending: false });

  if (q) {
    // filter by agent name — need to use a different approach since we're joining
    // fetch more and filter client-side for the join filter
    const { data: matchingAgents } = await supabaseAdmin
      .from("agents")
      .select("id")
      .ilike("name", `%${q}%`);

    if (!matchingAgents || matchingAgents.length === 0) {
      return NextResponse.json({ attempts: [], total: 0, hasMore: false });
    }

    query = query.in("agent_id", matchingAgents.map((a) => a.id));
  }

  query = query.range(offset, offset + limit - 1);

  const { data, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: "fetch failed" }, { status: 500 });
  }

  return NextResponse.json({
    attempts: data || [],
    total: count || 0,
    hasMore: (count || 0) > offset + limit,
  });
}
