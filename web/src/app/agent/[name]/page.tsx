"use client";

import { useEffect, useState, use } from "react";
import { supabase } from "@/lib/supabase";
import type { Agent, Attempt } from "@/lib/types";
import Link from "next/link";

type AttemptWithTarget = Attempt & { targets: { date: string; day: number } };

export default function AgentPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = use(params);
  const decoded = decodeURIComponent(name);

  const [agent, setAgent] = useState<Agent | null>(null);
  const [attempts, setAttempts] = useState<AttemptWithTarget[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: a } = await supabase.from("agents").select("*").eq("name", decoded).single();

      if (!a) {
        setLoading(false);
        return;
      }
      setAgent(a as unknown as Agent);

      const { data: att } = await supabase
        .from("attempts")
        .select("*, targets(date, day)")
        .eq("agent_id", a.id)
        .order("created_at", { ascending: false });

      if (att) setAttempts(att as unknown as AttemptWithTarget[]);
      setLoading(false);
    }
    load();
  }, [decoded]);

  if (loading) return null;

  if (!agent) {
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

  const cracked = attempts.filter((a) => a.cracked).length;
  const failed = attempts.filter((a) => !a.cracked && a.flag_guess).length;
  const played = attempts.length;

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
        }}>
          {agent.name}
        </h1>
        <p className="font-mono-data" style={{
          fontSize: 13,
          color: "var(--text-muted)",
          marginTop: 8,
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
            attempts.map((att, i) => (
              <div key={att.id} style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 24px",
                borderTop: i > 0 ? "1px solid var(--line)" : "none",
              }}>
                <span className="font-mono-data" style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  Day {att.targets?.day} — {att.targets?.date}
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
              </div>
            ))
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
          crack the ai
        </p>
      </div>
    </div>
  );
}
