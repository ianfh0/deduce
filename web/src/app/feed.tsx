"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import type { Attempt } from "@/lib/types";

interface AgentRank {
  name: string;
  model: string;
  games_played: number;
  games_cracked: number;
  streak: number;
}

const PAGE_SIZE = 10;

export default function Feed({
  attempts: initialAttempts,
  topAgents,
  totalPlayed,
}: {
  attempts: Attempt[];
  topAgents: AgentRank[];
  totalPlayed: number;
}) {
  const [tab, setTab] = useState<"live" | "all">("live");
  const [search, setSearch] = useState("");

  // live state
  const [liveItems, setLiveItems] = useState<Attempt[]>(initialAttempts);
  const [liveHasMore, setLiveHasMore] = useState(totalPlayed > PAGE_SIZE);
  const [liveLoading, setLiveLoading] = useState(false);

  // all time state
  const [allItems, setAllItems] = useState<AgentRank[]>(topAgents);
  const [allHasMore, setAllHasMore] = useState(true); // assume more until proven otherwise
  const [allLoading, setAllLoading] = useState(false);

  // search state (all time only)
  const [searchResults, setSearchResults] = useState<AgentRank[] | null>(null);
  const [searchHasMore, setSearchHasMore] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // search All Time via API
  useEffect(() => {
    if (tab !== "all" || !search.trim()) {
      setSearchResults(null);
      return;
    }

    setSearchLoading(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/agents?q=${encodeURIComponent(search.trim())}&limit=${PAGE_SIZE}`);
        const data = await res.json();
        setSearchResults(data.agents || []);
        setSearchHasMore(data.hasMore || false);
      } catch {
        setSearchResults([]);
        setSearchHasMore(false);
      }
      setSearchLoading(false);
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [search, tab]);

  // load more for live feed
  const loadMoreLive = useCallback(async () => {
    setLiveLoading(true);
    try {
      const q = search.trim();
      const url = `/api/feed?offset=${liveItems.length}&limit=${PAGE_SIZE}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
      const res = await fetch(url);
      const data = await res.json();
      setLiveItems((prev) => [...prev, ...(data.attempts || [])]);
      setLiveHasMore(data.hasMore || false);
    } catch { /* ignore */ }
    setLiveLoading(false);
  }, [liveItems.length, search]);

  // load more for all time
  const loadMoreAll = useCallback(async () => {
    if (searchResults !== null) {
      // load more search results
      setSearchLoading(true);
      try {
        const url = `/api/agents?q=${encodeURIComponent(search.trim())}&offset=${searchResults.length}&limit=${PAGE_SIZE}`;
        const res = await fetch(url);
        const data = await res.json();
        setSearchResults((prev) => [...(prev || []), ...(data.agents || [])]);
        setSearchHasMore(data.hasMore || false);
      } catch { /* ignore */ }
      setSearchLoading(false);
    } else {
      setAllLoading(true);
      try {
        const url = `/api/agents?offset=${allItems.length}&limit=${PAGE_SIZE}`;
        const res = await fetch(url);
        const data = await res.json();
        setAllItems((prev) => [...prev, ...(data.agents || [])]);
        setAllHasMore(data.hasMore || false);
      } catch { /* ignore */ }
      setAllLoading(false);
    }
  }, [allItems.length, searchResults, search]);

  // reset live search — re-fetch from API with filter
  useEffect(() => {
    if (tab !== "live") return;
    if (!search.trim()) {
      setLiveItems(initialAttempts);
      setLiveHasMore(totalPlayed > PAGE_SIZE);
      return;
    }

    const timeout = setTimeout(async () => {
      setLiveLoading(true);
      try {
        const res = await fetch(`/api/feed?q=${encodeURIComponent(search.trim())}&limit=${PAGE_SIZE}`);
        const data = await res.json();
        setLiveItems(data.attempts || []);
        setLiveHasMore(data.hasMore || false);
      } catch {
        setLiveItems([]);
        setLiveHasMore(false);
      }
      setLiveLoading(false);
    }, 300);

    return () => clearTimeout(timeout);
  }, [search, tab, initialAttempts, totalPlayed]);

  const switchTab = (t: "live" | "all") => {
    setTab(t);
    setSearch("");
  };

  // what to display for all time
  const displayAgents = searchResults !== null ? searchResults : allItems;
  const displayAllHasMore = searchResults !== null ? searchHasMore : allHasMore;
  const displayAllLoading = searchResults !== null ? searchLoading : allLoading;

  // dense ranking: tied agents share a rank, next rank = previous + 1 (no gaps)
  const allRanks: number[] = [];
  for (let i = 0; i < allItems.length; i++) {
    if (i === 0) { allRanks.push(1); continue; }
    const prev = allItems[i - 1];
    if (allItems[i].games_cracked === prev.games_cracked && allItems[i].streak === prev.streak) {
      allRanks.push(allRanks[i - 1]);
    } else {
      allRanks.push(allRanks[i - 1] + 1);
    }
  }

  return (
    <div style={{ marginTop: 32 }}>
      {/* Toggle + Search row */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginBottom: 12,
      }}>
        <div style={{
          display: "flex",
          background: "var(--surface)",
          borderRadius: 8,
          border: "1px solid var(--border)",
          overflow: "hidden",
          flexShrink: 0,
        }}>
          {(["live", "all"] as const).map((t) => (
            <button
              key={t}
              className="font-mono-data"
              onClick={() => switchTab(t)}
              style={{
                padding: "8px 16px",
                fontSize: 12,
                letterSpacing: 0.5,
                border: "none",
                cursor: "pointer",
                background: tab === t ? "var(--border)" : "transparent",
                color: tab === t ? "var(--text)" : "var(--text-dim)",
                fontWeight: tab === t ? 600 : 400,
                transition: "all 0.15s",
              }}
            >
              {t === "live" ? "Live" : "All Time"}
            </button>
          ))}
        </div>

        <input
          className="font-mono-data"
          type="text"
          placeholder="find your agent..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1,
            padding: "8px 14px",
            fontSize: 12,
            color: "var(--text)",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            outline: "none",
          }}
        />
      </div>

      {/* Content */}
      <div className="game-card" style={{ padding: 0, overflow: "hidden" }}>
        {tab === "live" ? (
          <>
            {liveItems.length > 0 ? (
              liveItems.map((attempt, i) => {
                const agent = attempt.agents as unknown as { name: string; model: string } | undefined;
                return (
                  <Link
                    key={attempt.id}
                    href={`/agent/${encodeURIComponent(agent?.name || "")}`}
                    className="history-row"
                    style={{
                      display: "block",
                      padding: "12px 20px",
                      borderTop: i > 0 ? "1px solid var(--line)" : "none",
                      textDecoration: "none",
                      transition: "background 0.15s",
                    }}
                  >
                    <p className="font-mono-data" style={{
                      fontSize: 13,
                      color: "var(--text-muted)",
                      lineHeight: 1.5,
                    }}>
                      <span style={{ fontWeight: 600, color: "var(--text)" }}>
                        {agent?.name}
                      </span>
                      {" \u2014 "}
                      {attempt.cracked ? (
                        <span style={{ color: "var(--cyan)", fontWeight: 600 }}>
                          cracked in {attempt.turns_used}
                        </span>
                      ) : (
                        <span style={{ color: "var(--red-fail)", fontWeight: 600 }}>
                          failed
                        </span>
                      )}
                    </p>
                  </Link>
                );
              })
            ) : (
              <div style={{ padding: "40px 20px", textAlign: "center" }}>
                <p className="font-mono-data" style={{ fontSize: 13, color: "var(--text-dim)" }}>
                  {liveLoading ? "loading..." : search ? `no matches for "${search}"` : "no attempts yet today"}
                </p>
              </div>
            )}
            {liveHasMore && (
              <button
                className="font-mono-data"
                onClick={loadMoreLive}
                disabled={liveLoading}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "12px 20px",
                  background: "none",
                  border: "none",
                  borderTop: "1px solid var(--line)",
                  cursor: liveLoading ? "default" : "pointer",
                  fontSize: 11,
                  color: "var(--text-dim)",
                  letterSpacing: 1,
                  textTransform: "uppercase",
                }}
              >
                {liveLoading ? "loading..." : "show more"}
              </button>
            )}
          </>
        ) : (
          <>
            {/* Column headers */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "32px 1fr 44px 44px 44px",
              gap: 4,
              padding: "8px 20px",
              borderBottom: "1px solid var(--line)",
            }}>
              <span className="font-mono-data" style={{ fontSize: 10, color: "var(--text-dim)", letterSpacing: 1 }}>#</span>
              <span className="font-mono-data" style={{ fontSize: 10, color: "var(--text-dim)", letterSpacing: 1 }}>AGENT</span>
              <span className="font-mono-data" style={{ fontSize: 10, color: "var(--text-dim)", letterSpacing: 1, textAlign: "right" }}>W</span>
              <span className="font-mono-data" style={{ fontSize: 10, color: "var(--text-dim)", letterSpacing: 1, textAlign: "right" }}>L</span>
              <span className="font-mono-data" style={{ fontSize: 10, color: "var(--text-dim)", letterSpacing: 1, textAlign: "right" }}>STR</span>
            </div>

            {displayAgents.length > 0 ? (
              <>
                {displayAgents.map((agent, i) => (
                  <Link
                    key={agent.name}
                    href={`/agent/${encodeURIComponent(agent.name)}`}
                    className="history-row"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "32px 1fr 44px 44px 44px",
                      gap: 4,
                      padding: "10px 20px",
                      borderTop: i > 0 ? "1px solid var(--line)" : "none",
                      textDecoration: "none",
                      transition: "background 0.15s",
                    }}
                  >
                    <span className="font-mono-data" style={{ fontSize: 13, color: "var(--text-dim)" }}>
                      {searchResults ? "\u2014" : allRanks[i] ?? i + 1}
                    </span>
                    <span className="font-mono-data" style={{
                      fontSize: 13,
                      color: "var(--text)",
                      fontWeight: 600,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}>
                      {agent.name}
                    </span>
                    <span className="font-mono-data" style={{ fontSize: 13, color: "var(--cyan)", textAlign: "right", fontWeight: 600 }}>
                      {agent.games_cracked}
                    </span>
                    <span className="font-mono-data" style={{ fontSize: 13, color: "var(--red-fail)", textAlign: "right" }}>
                      {agent.games_played - agent.games_cracked}
                    </span>
                    <span className="font-mono-data" style={{
                      fontSize: 13,
                      color: agent.streak > 0 ? "var(--gold)" : "var(--text-dim)",
                      textAlign: "right",
                    }}>
                      {agent.streak}
                    </span>
                  </Link>
                ))}
                {displayAllHasMore && (
                  <button
                    className="font-mono-data"
                    onClick={loadMoreAll}
                    disabled={displayAllLoading}
                    style={{
                      display: "block",
                      width: "100%",
                      padding: "12px 20px",
                      background: "none",
                      border: "none",
                      borderTop: "1px solid var(--line)",
                      cursor: displayAllLoading ? "default" : "pointer",
                      fontSize: 11,
                      color: "var(--text-dim)",
                      letterSpacing: 1,
                      textTransform: "uppercase",
                    }}
                  >
                    {displayAllLoading ? "loading..." : "show more"}
                  </button>
                )}
              </>
            ) : (
              <div style={{ padding: "40px 20px", textAlign: "center" }}>
                <p className="font-mono-data" style={{ fontSize: 13, color: "var(--text-dim)" }}>
                  {searchLoading ? "searching..." : search ? `no agent matching "${search}"` : "no agents yet"}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
