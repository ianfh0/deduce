import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

const MIN_GAMES = 3;

interface AgentRow {
  name: string;
  model: string;
  games_played: number;
  games_cracked: number;
  streak: number;
}

function rankAgents(agents: AgentRow[]): (AgentRow & { win_pct: number; ranked: boolean })[] {
  return agents
    .map((a) => ({
      ...a,
      win_pct: a.games_played > 0 ? a.games_cracked / a.games_played : 0,
      ranked: a.games_played >= MIN_GAMES,
    }))
    .sort((a, b) => {
      // ranked agents always above unranked
      if (a.ranked !== b.ranked) return a.ranked ? -1 : 1;
      // sort by win percentage descending
      if (b.win_pct !== a.win_pct) return b.win_pct - a.win_pct;
      // tiebreak: more wins = higher
      if (b.games_cracked !== a.games_cracked) return b.games_cracked - a.games_cracked;
      // tiebreak: longer streak = hotter
      if (b.streak !== a.streak) return b.streak - a.streak;
      // last tiebreak: fewer games played (more efficient)
      return a.games_played - b.games_played;
    });
}

// GET /api/agents?q=search — search agents by name
// GET /api/agents?offset=0&limit=10 — paginated leaderboard (ranked by W-L record)
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "10", 10), 50);
  const offset = parseInt(req.nextUrl.searchParams.get("offset") || "0", 10);

  // fetch all agents (sort in JS since supabase can't sort by computed win_pct)
  let query = supabaseAdmin
    .from("agents")
    .select("name, model, games_played, games_cracked, streak", { count: "exact" })
    .gt("games_played", 0);

  if (q) {
    query = query.ilike("name", `%${q}%`);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: "search failed" }, { status: 500 });
  }

  const sorted = rankAgents((data || []) as AgentRow[]);
  const total = sorted.length;
  const page = sorted.slice(offset, offset + limit);

  return NextResponse.json({
    agents: page,
    total,
    hasMore: total > offset + limit,
  });
}
