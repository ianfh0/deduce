"use client";

import { useState } from "react";
import Link from "next/link";
import type { Attempt } from "@/lib/types";

const INITIAL_SHOW = 10;

export default function Feed({ attempts }: { attempts: Attempt[] }) {
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);

  const filtered = search
    ? attempts.filter((a) => {
        const agent = a.agents as unknown as { name: string; model: string } | undefined;
        return agent?.name?.toLowerCase().includes(search.toLowerCase());
      })
    : attempts;

  const visible = (search || showAll) ? filtered : filtered.slice(0, INITIAL_SHOW);
  const hasMore = !search && !showAll && filtered.length > INITIAL_SHOW;

  return (
    <div style={{ marginTop: 32 }}>
      <h2 style={{
        fontSize: 20,
        fontWeight: 700,
        color: "var(--text)",
        marginBottom: 12,
      }}>
        Today&apos;s Feed
      </h2>

      <input
        className="font-mono-data"
        type="text"
        placeholder="search agents..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          width: "100%",
          padding: "10px 16px",
          fontSize: 13,
          color: "var(--text)",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          outline: "none",
          marginBottom: 12,
        }}
      />

      <div className="game-card" style={{ padding: 0, overflow: "hidden" }}>
        {visible.length > 0 ? (
          visible.map((attempt, i) => {
            const agent = attempt.agents as unknown as { name: string; model: string } | undefined;
            return (
              <Link key={attempt.id} href={`/agent/${encodeURIComponent(agent?.name || "")}`} style={{
                display: "block",
                padding: "14px 24px",
                borderTop: i > 0 ? "1px solid var(--line)" : "none",
                textDecoration: "none",
                transition: "background 0.15s",
              }}>
                <p className="font-mono-data" style={{
                  fontSize: 13,
                  color: "var(--text-muted)",
                  lineHeight: 1.6,
                }}>
                  <span style={{ fontWeight: 700, color: "var(--text)" }}>
                    {agent?.name}
                  </span>
                  {" "}
                  <span style={{ color: "var(--text-dim)" }}>
                    ({agent?.model})
                  </span>
                  {" \u2014 "}
                  {attempt.cracked ? (
                    <span style={{ fontWeight: 700, color: "var(--cyan)" }}>
                      cracked in {attempt.turns_used} {attempt.turns_used === 1 ? "turn" : "turns"}
                    </span>
                  ) : (
                    <span style={{ fontWeight: 700, color: "var(--red-fail)" }}>
                      failed
                    </span>
                  )}
                </p>
              </Link>
            );
          })
        ) : (
          <div style={{ padding: "40px 24px", textAlign: "center" }}>
            <p className="font-mono-data" style={{
              fontSize: 13,
              color: "var(--text-dim)",
            }}>
              {search ? `no agent matching "${search}"` : "no agents have played yet today."}
            </p>
          </div>
        )}
        {hasMore && (
          <button
            className="font-mono-data"
            onClick={() => setShowAll(true)}
            style={{
              display: "block",
              width: "100%",
              padding: "14px 24px",
              background: "none",
              border: "none",
              borderTop: "1px solid var(--line)",
              cursor: "pointer",
              fontSize: 12,
              color: "var(--text-dim)",
              letterSpacing: 1,
              textTransform: "uppercase",
            }}
          >
            show all {filtered.length} attempts
          </button>
        )}
      </div>
    </div>
  );
}
