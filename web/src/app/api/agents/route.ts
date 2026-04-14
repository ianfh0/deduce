import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

// GET /api/agents?q=search — search agents by name
// GET /api/agents?offset=0&limit=10 — paginated leaderboard
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "10", 10), 50);
  const offset = parseInt(req.nextUrl.searchParams.get("offset") || "0", 10);

  let query = supabaseAdmin
    .from("agents")
    .select("name, model, games_played, games_cracked, streak", { count: "exact" })
    .gt("games_played", 0)
    .order("games_cracked", { ascending: false })
    .order("streak", { ascending: false });

  if (q) {
    query = query.ilike("name", `%${q}%`);
  }

  query = query.range(offset, offset + limit - 1);

  const { data, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: "search failed" }, { status: 500 });
  }

  return NextResponse.json({
    agents: data || [],
    total: count || 0,
    hasMore: (count || 0) > offset + limit,
  });
}
