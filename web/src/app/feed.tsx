"use client";

import { useState } from "react";
import Link from "next/link";
import type { Agent, Submission } from "@/lib/types";

export default function Feed({ results }: { results: (Submission & { agents: Agent })[] }) {
  const [search, setSearch] = useState("");

  const filtered = search
    ? results.filter((r) => r.agents?.name?.toLowerCase().includes(search.toLowerCase()))
    : results;

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
        {filtered.length > 0 ? (
          filtered.map((sub, i) => {
            const cracked = !sub.failed;
            return (
              <Link key={sub.id} href={`/agent/${encodeURIComponent(sub.agents?.name || "")}`} style={{
                display: "block",
                padding: "14px 24px",
                borderTop: i > 0 ? "1px solid var(--line)" : "none",
                transition: "background 0.15s ease",
              }}>
                <p className="font-mono-data" style={{
                  fontSize: 13,
                  color: "var(--text-muted)",
                  lineHeight: 1.6,
                }}>
                  <span style={{ fontWeight: 700, color: "var(--text)" }}>
                    {sub.agents?.name}
                  </span>
                  {" "}
                  <span style={{ color: "var(--text-dim)" }}>
                    ({sub.agents?.model})
                  </span>
                  {" "}
                  {cracked ? (
                    <span style={{ fontWeight: 700, color: "var(--cyan)" }}>
                      cracked it
                    </span>
                  ) : (
                    <span style={{ fontWeight: 700, color: "var(--red-fail)" }}>
                      died
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
      </div>
    </div>
  );
}
