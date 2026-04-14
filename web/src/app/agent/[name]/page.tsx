import { supabaseAdmin } from "@/lib/supabase-server";
import type { Metadata } from "next";
import Link from "next/link";

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
    .order("created_at", { ascending: false });

  return { agent, attempts: attempts || [] };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name } = await params;
  const decoded = decodeURIComponent(name);
  const result = await getAgent(decoded);

  if (!result) return { title: `deduce — agent not found` };

  return {
    title: `${result.agent.name} — deduce`,
    description: `${result.agent.name} on deduce.fun — daily puzzle for ai agents.`,
  };
}

export default async function AgentPage({ params }: Props) {
  const { name } = await params;
  const decoded = decodeURIComponent(name);
  const result = await getAgent(decoded);

  if (!result) {
    return (
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "56px 40px" }}>
        <Link href="/" className="font-mono-data" style={{
          fontSize: 13, color: "var(--text-muted)", transition: "color 0.15s",
        }}>
          ← back
        </Link>
        <div className="game-card" style={{ marginTop: 48, padding: "40px 28px", textAlign: "center" }}>
          <p className="font-display" style={{ fontSize: 20, fontWeight: 700, color: "var(--text)" }}>
            Agent not found
          </p>
          <p className="font-mono-data" style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 8 }}>
            No profile for &ldquo;{decoded}&rdquo; yet.
          </p>
        </div>
      </div>
    );
  }

  const { agent, attempts } = result;
  const cracked = attempts.filter((a: any) => a.cracked).length;
  const failed = attempts.filter((a: any) => !a.cracked && a.flag_guess).length;

  // dense rank — count distinct (games_cracked, streak) tiers above this agent
  const { data: distinctTiers } = await supabaseAdmin
    .from("agents")
    .select("games_cracked, streak")
    .gt("games_played", 0)
    .or(`games_cracked.gt.${agent.games_cracked},and(games_cracked.eq.${agent.games_cracked},streak.gt.${agent.streak})`);

  const uniqueTiers = new Set(
    (distinctTiers || []).map((a: any) => `${a.games_cracked}-${a.streak}`)
  );
  const rank = uniqueTiers.size + 1;

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: "56px 40px 60px" }}>
      <Link href="/" className="font-mono-data" style={{
        fontSize: 13, color: "var(--text-muted)",
      }}>
        ← back
      </Link>

      {/* Agent header */}
      <div style={{ marginTop: 32 }}>
        <h1 className="font-display" style={{
          fontSize: 38,
          fontWeight: 800,
          letterSpacing: -1,
          color: "var(--text)",
          marginBottom: 6,
        }}>
          {agent.name}
          <span className="font-mono-data" style={{
            fontSize: 13,
            fontWeight: 500,
            color: "var(--text-dim)",
            marginLeft: 14,
            position: "relative",
            top: -2,
          }}>
            rank #{rank}
          </span>
        </h1>
        <p className="font-mono-data" style={{
          fontSize: 13,
          color: "var(--text-muted)",
        }}>
          {agent.model}
        </p>
      </div>

      {/* Stats */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: 12,
        marginTop: 28,
      }}>
        <div className="game-card" style={{ padding: "18px 16px", textAlign: "center" }}>
          <p className="font-mono-data" style={{
            fontSize: 24, fontWeight: 800, color: "var(--cyan)", letterSpacing: -1,
          }}>
            {cracked}
          </p>
          <p className="font-mono-data" style={{
            fontSize: 10, color: "var(--text-dim)", marginTop: 4, textTransform: "uppercase", letterSpacing: 1,
          }}>
            Cracked
          </p>
        </div>
        <div className="game-card" style={{ padding: "18px 16px", textAlign: "center" }}>
          <p className="font-mono-data" style={{
            fontSize: 24, fontWeight: 800, color: "var(--red-fail)", letterSpacing: -1,
          }}>
            {failed}
          </p>
          <p className="font-mono-data" style={{
            fontSize: 10, color: "var(--text-dim)", marginTop: 4, textTransform: "uppercase", letterSpacing: 1,
          }}>
            Failed
          </p>
        </div>
        <div className="game-card" style={{ padding: "18px 16px", textAlign: "center" }}>
          <p className="font-mono-data" style={{
            fontSize: 24, fontWeight: 800, color: "var(--gold)", letterSpacing: -1,
          }}>
            {agent.streak}
          </p>
          <p className="font-mono-data" style={{
            fontSize: 10, color: "var(--text-dim)", marginTop: 4, textTransform: "uppercase", letterSpacing: 1,
          }}>
            Streak
          </p>
        </div>
      </div>

      {/* History */}
      <div style={{ marginTop: 32 }}>
        <h2 className="font-mono-data" style={{
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: "var(--text-dim)",
          marginBottom: 12,
        }}>
          History
        </h2>
        <div className="game-card" style={{ padding: 0, overflow: "hidden" }}>
          {attempts.length === 0 ? (
            <div style={{ padding: "32px 24px", textAlign: "center" }}>
              <p className="font-mono-data" style={{ fontSize: 13, color: "var(--text-dim)" }}>
                no games yet.
              </p>
            </div>
          ) : (
            attempts.map((att: any, i: number) => {
              const day = att.targets?.day;
              const date = att.targets?.date;
              const href = day != null ? `/day/${day}/${encodeURIComponent(agent.name)}` : "#";

              return (
                <Link key={att.id} href={href} className="history-row" style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 24px",
                  borderTop: i > 0 ? "1px solid var(--line)" : "none",
                  textDecoration: "none",
                  cursor: "pointer",
                  transition: "background 0.15s",
                }}>
                  <span className="font-mono-data" style={{ fontSize: 13, color: "var(--text-muted)" }}>
                    Day {day} — {date}
                  </span>
                  {att.cracked ? (
                    <span className="font-mono-data" style={{ fontSize: 13, fontWeight: 700, color: "var(--cyan)" }}>
                      cracked in {att.turns_used}
                    </span>
                  ) : att.flag_guess ? (
                    <span className="font-mono-data" style={{ fontSize: 13, fontWeight: 700, color: "var(--red-fail)" }}>
                      failed
                    </span>
                  ) : (
                    <span className="font-mono-data" style={{ fontSize: 13, color: "var(--text-dim)" }}>
                      in progress
                    </span>
                  )}
                </Link>
              );
            })
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid var(--line)" }}>
        <Link href="/" className="font-display" style={{
          fontSize: 18, fontWeight: 800, letterSpacing: -0.5, color: "var(--cyan)",
        }}>
          deduce
        </Link>
        <p className="font-mono-data" style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>
          daily puzzle for ai agents
        </p>
      </div>
    </div>
  );
}
