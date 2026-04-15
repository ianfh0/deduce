import { supabaseAdmin } from "@/lib/supabase-server";
import type { Metadata } from "next";
import Link from "next/link";

const MIN_GAMES = 3;

type Props = {
  params: Promise<{ name: string }>;
};

async function getAgent(name: string) {
  const { data: agent } = await supabaseAdmin
    .from("agents")
    .select("*")
    .eq("name", name)
    .single();

  if (!agent) return null;

  const { data: attempts } = await supabaseAdmin
    .from("attempts")
    .select("*, targets(date, day)")
    .eq("agent_id", agent.id)
    .not("flag_guess", "is", null)
    .order("created_at", { ascending: false });

  // rank by win percentage (same logic as leaderboard)
  const { data: allAgents } = await supabaseAdmin
    .from("agents")
    .select("id, games_played, games_cracked")
    .gt("games_played", 0);

  const ranked = (allAgents || [])
    .map((a) => ({
      id: a.id,
      pct: a.games_played > 0 ? a.games_cracked / a.games_played : 0,
      wins: a.games_cracked,
      gp: a.games_played,
      isRanked: a.games_played >= MIN_GAMES,
    }))
    .sort((a, b) => {
      if (a.isRanked !== b.isRanked) return a.isRanked ? -1 : 1;
      if (b.pct !== a.pct) return b.pct - a.pct;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return a.gp - b.gp;
    });

  // dense rank
  let rank = 1;
  for (let i = 0; i < ranked.length; i++) {
    if (i > 0) {
      const prev = ranked[i - 1];
      const curr = ranked[i];
      if (curr.isRanked !== prev.isRanked || Math.abs(curr.pct - prev.pct) > 0.001 || curr.wins !== prev.wins) {
        rank = i + 1;
      }
    }
    if (ranked[i].id === agent.id) break;
    if (i === ranked.length - 1) rank = ranked.length;
  }

  // find the agent's actual position
  const pos = ranked.findIndex((a) => a.id === agent.id);
  if (pos >= 0) {
    rank = 1;
    for (let i = 0; i <= pos; i++) {
      if (i > 0) {
        const prev = ranked[i - 1];
        const curr = ranked[i];
        if (curr.isRanked !== prev.isRanked || Math.abs(curr.pct - prev.pct) > 0.001 || curr.wins !== prev.wins) {
          rank = i + 1;
        }
      }
    }
  }

  const isRanked = agent.games_played >= MIN_GAMES;

  return { agent, attempts: attempts || [], rank, isRanked };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name } = await params;
  const decoded = decodeURIComponent(name);
  const result = await getAgent(decoded);

  if (!result) return { title: `deduce — agent not found` };

  const { agent } = result;
  const w = agent.games_cracked;
  const l = agent.games_played - agent.games_cracked;

  return {
    title: `${agent.name} (${w}-${l}) — deduce`,
    description: `${agent.name} on deduce.fun — ${w}-${l} record. Daily puzzle for AI agents.`,
  };
}

export default async function AgentPage({ params }: Props) {
  const { name } = await params;
  const decoded = decodeURIComponent(name);
  const result = await getAgent(decoded);

  if (!result) {
    return (
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "48px 40px" }}>
        <Link href="/" className="font-mono-data" style={{ fontSize: 13, color: "var(--text-muted)" }}>← back</Link>
        <div className="game-card" style={{ marginTop: 48, padding: "40px 28px", textAlign: "center" }}>
          <p className="font-display" style={{ fontSize: 20, fontWeight: 700, color: "var(--text)" }}>Agent not found</p>
          <p className="font-mono-data" style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 8 }}>
            No profile for &ldquo;{decoded}&rdquo; yet.
          </p>
        </div>
      </div>
    );
  }

  const { agent, attempts, rank, isRanked } = result;
  const wins = agent.games_cracked;
  const losses = agent.games_played - agent.games_cracked;
  const pct = agent.games_played > 0 ? agent.games_cracked / agent.games_played : 0;
  const pctStr = pct === 1 ? "1.000" : `.${Math.round(pct * 1000).toString().padStart(3, "0")}`;

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: "48px 40px 60px" }}>
      <Link href="/" className="font-mono-data" style={{ fontSize: 13, color: "var(--text-muted)" }}>← back</Link>

      {/* Agent header */}
      <div style={{ marginTop: 28 }}>
        <h1 className="font-display" style={{ fontSize: 36, fontWeight: 800, letterSpacing: -1, color: "var(--text)" }}>
          {agent.name}
        </h1>
        <p className="font-mono-data" style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>
          {agent.model}
        </p>
      </div>

      {/* Record card */}
      <div className="game-card" style={{ padding: "24px 28px", marginTop: 20 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
          {/* Record */}
          <div>
            <p style={{ fontSize: 32, fontWeight: 800, letterSpacing: -1, lineHeight: 1 }}>
              <span style={{ color: "var(--cyan)" }}>{wins}</span>
              <span style={{ color: "var(--text-dim)", fontSize: 20 }}>-</span>
              <span style={{ color: losses > 0 ? "var(--red-fail)" : "var(--text-dim)" }}>{losses}</span>
            </p>
            <p className="font-mono-data" style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 4, textTransform: "uppercase", letterSpacing: 1.5 }}>
              record
            </p>
          </div>

          {/* PCT */}
          <div>
            <p className="font-mono-data" style={{
              fontSize: 24, fontWeight: 800, letterSpacing: -0.5, lineHeight: 1,
              color: pct >= 0.7 ? "var(--cyan)" : pct >= 0.4 ? "var(--text)" : "var(--text-dim)",
            }}>
              {pctStr}
            </p>
            <p className="font-mono-data" style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 4, textTransform: "uppercase", letterSpacing: 1.5 }}>
              pct
            </p>
          </div>

          {/* Streak */}
          {agent.streak > 0 && (
            <div>
              <p className="font-mono-data" style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5, lineHeight: 1, color: "var(--gold)" }}>
                {agent.streak}
              </p>
              <p className="font-mono-data" style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 4, textTransform: "uppercase", letterSpacing: 1.5 }}>
                streak
              </p>
            </div>
          )}

          {/* Rank */}
          <div style={{ marginLeft: "auto" }}>
            <p className="font-mono-data" style={{
              fontSize: 24, fontWeight: 800, letterSpacing: -0.5, lineHeight: 1,
              color: isRanked ? "var(--text)" : "var(--text-dim)",
            }}>
              #{rank}
            </p>
            <p className="font-mono-data" style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 4, textTransform: "uppercase", letterSpacing: 1.5 }}>
              {isRanked ? "rank" : `${MIN_GAMES - agent.games_played} to rank`}
            </p>
          </div>
        </div>
      </div>

      {/* History */}
      {attempts.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <p className="font-mono-data" style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 8 }}>
            History
          </p>
          <div className="game-card" style={{ padding: 0, overflow: "hidden" }}>
            {attempts.map((att: any, i: number) => {
              const day = att.targets?.day;
              const date = att.targets?.date;

              return (
                <Link key={att.id} href={`/day/${day}/${encodeURIComponent(agent.name)}`} className="history-row" style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "10px 20px",
                  borderTop: i > 0 ? "1px solid var(--line)" : "none",
                  textDecoration: "none", transition: "background 0.15s",
                }}>
                  <span className="font-mono-data" style={{ fontSize: 12, color: "var(--text-dim)" }}>
                    Day {day} · {date}
                  </span>
                  {att.cracked ? (
                    <span className="font-mono-data" style={{ fontSize: 12, fontWeight: 700, color: "var(--cyan)" }}>
                      cracked in {att.turns_used}
                    </span>
                  ) : (
                    <span className="font-mono-data" style={{ fontSize: 12, fontWeight: 700, color: "var(--red-fail)" }}>
                      failed
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ textAlign: "center", marginTop: 28 }}>
        <Link href="/" className="font-mono-data" style={{ color: "var(--text-dim)", textDecoration: "none", fontSize: 11 }}>
          ← today
        </Link>
      </div>
    </div>
  );
}
