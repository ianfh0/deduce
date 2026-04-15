"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { ConversationTurn } from "@/lib/types";

interface PlaybackData {
  agent: string;
  agent_model: string;
  day: number;
  date: string;
  briefing: string;
  defender_model: string;
  vulnerability_type?: string;
  turns_used: number;
  cracked: boolean;
  guess: string;
  flag?: string;
  conversation: ConversationTurn[];
}

type PlayState = "loading" | "ready" | "playing" | "done";

const CHAR_DELAY = 12;
const PAUSE_BETWEEN = 600;
const THINKING_MIN = 400;
const THINKING_MAX = 1200;

export default function ConversationPlayback({ sessionId }: { sessionId: string }) {
  const [data, setData] = useState<PlaybackData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playState, setPlayState] = useState<PlayState>("loading");

  const [visibleCount, setVisibleCount] = useState(0);
  const [typedChars, setTypedChars] = useState(0);
  const [showThinking, setShowThinking] = useState(false);
  const [showGuess, setShowGuess] = useState(false);
  const [showResult, setShowResult] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef(false);
  const speedRef = useRef(1);
  const userScrolledUpRef = useRef(false);

  // fetch data
  useEffect(() => {
    fetch(`/api/playback?s=${sessionId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setError(d.error);
          setPlayState("loading");
        } else {
          setData(d);
          setPlayState("ready");
        }
      })
      .catch(() => setError("failed to load playback"));
  }, [sessionId]);

  // track if user scrolled up — if so, stop auto-scrolling
  useEffect(() => {
    const onScroll = () => {
      const scrollBottom = window.innerHeight + window.scrollY;
      const docHeight = document.documentElement.scrollHeight;
      // if user is within 150px of bottom, they're "following along"
      userScrolledUpRef.current = docHeight - scrollBottom > 150;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToBottom = useCallback(() => {
    // only auto-scroll if user hasn't scrolled up
    if (!userScrolledUpRef.current && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, []);

  const play = useCallback(async () => {
    if (!data) return;
    abortRef.current = false;
    userScrolledUpRef.current = false;
    setPlayState("playing");
    setVisibleCount(0);
    setTypedChars(0);
    setShowGuess(false);
    setShowResult(false);

    const msgs = data.conversation;

    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, ms / speedRef.current);
      });

    for (let i = 0; i < msgs.length; i++) {
      if (abortRef.current) return;

      setShowThinking(true);
      scrollToBottom();
      await sleep(THINKING_MIN + Math.random() * (THINKING_MAX - THINKING_MIN));
      if (abortRef.current) return;
      setShowThinking(false);

      setVisibleCount(i + 1);
      setTypedChars(0);

      const content = msgs[i].content;
      for (let c = 0; c <= content.length; c++) {
        if (abortRef.current) return;
        setTypedChars(c);
        if (c < content.length) await sleep(CHAR_DELAY);
      }

      scrollToBottom();
      if (i < msgs.length - 1) await sleep(PAUSE_BETWEEN);
    }

    await sleep(600);
    setShowGuess(true);
    scrollToBottom();

    await sleep(1400);
    setShowResult(true);
    setPlayState("done");
    scrollToBottom();
  }, [data, scrollToBottom]);

  const skipToEnd = useCallback(() => {
    abortRef.current = true;
    if (data) {
      setVisibleCount(data.conversation.length);
      setTypedChars(Infinity);
      setShowThinking(false);
      setShowGuess(true);
      setShowResult(true);
      setPlayState("done");
    }
  }, [data]);

  const cycleSpeed = useCallback(() => {
    speedRef.current = speedRef.current >= 4 ? 1 : speedRef.current * 2;
    setTypedChars((c) => c); // force re-render
  }, []);

  if (error) {
    return (
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "56px 40px 60px", textAlign: "center" }}>
        <h1 className="font-display" style={{ fontSize: 42, fontWeight: 800, color: "var(--cyan)", letterSpacing: -1.5 }}>deduce</h1>
        <p className="font-mono-data" style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 24 }}>{error}</p>
        <a href="/" style={{ color: "var(--cyan)", textDecoration: "none", fontSize: 13, marginTop: 16, display: "inline-block" }}>← back to today</a>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "56px 40px 60px", textAlign: "center" }}>
        <h1 className="font-display" style={{ fontSize: 42, fontWeight: 800, color: "var(--cyan)", letterSpacing: -1.5 }}>deduce</h1>
        <div style={{ marginTop: 40 }}>
          <div className="skeleton" style={{ height: 20, width: 200, margin: "0 auto" }} />
          <div className="skeleton" style={{ height: 14, width: 140, margin: "12px auto 0" }} />
        </div>
      </div>
    );
  }

  const msgs = data.conversation;

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: "48px 24px 80px" }}>
      {/* Header */}
      <div style={{ textAlign: "center" }}>
        <a href="/" style={{ textDecoration: "none" }}>
          <h1 className="font-display" style={{ fontSize: 36, fontWeight: 800, letterSpacing: -1.5, color: "var(--cyan)" }}>deduce</h1>
        </a>
        <p className="font-mono-data" style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4, textTransform: "uppercase", letterSpacing: 2 }}>
          day {data.day}
        </p>
      </div>

      {/* Agent + briefing */}
      <div style={{ textAlign: "center", marginTop: 20 }}>
        <a href={`/agent/${encodeURIComponent(data.agent)}`} style={{ textDecoration: "none" }}>
          <p className="font-mono-data" style={{ fontSize: 18, fontWeight: 800, color: "var(--text)", letterSpacing: -0.5 }}>
            {data.agent}
          </p>
        </a>
        <p className="font-mono-data" style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 2 }}>
          vs {data.defender_model}
        </p>
        <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-dim)", fontStyle: "italic", marginTop: 8, maxWidth: 400, margin: "8px auto 0" }}>
          &ldquo;{data.briefing}&rdquo;
        </p>
      </div>

      {/* Play button */}
      {playState === "ready" && (
        <div style={{ textAlign: "center", marginTop: 24 }}>
          <button
            onClick={play}
            className="font-mono-data"
            style={{
              background: "rgba(46, 230, 214, 0.1)",
              border: "1px solid rgba(46, 230, 214, 0.3)",
              borderRadius: 10,
              padding: "14px 36px",
              color: "var(--cyan)",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: 2,
              transition: "all 0.2s",
            }}
          >
            ▶ watch replay
          </button>
        </div>
      )}

      {/* Controls */}
      {playState === "playing" && (
        <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 16 }}>
          <button onClick={cycleSpeed} className="font-mono-data" style={{
            background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)",
            borderRadius: 8, padding: "6px 14px", color: "var(--text-muted)", fontSize: 11, cursor: "pointer",
          }}>
            {speedRef.current}x
          </button>
          <button onClick={skipToEnd} className="font-mono-data" style={{
            background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)",
            borderRadius: 8, padding: "6px 14px", color: "var(--text-muted)", fontSize: 11, cursor: "pointer",
          }}>
            skip →
          </button>
        </div>
      )}

      {/* Conversation */}
      {(playState === "playing" || playState === "done") && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {msgs.slice(0, visibleCount).map((turn, i) => {
              const isAttacker = turn.role === "attacker";
              const isLast = i === visibleCount - 1;
              const content = isLast && typedChars < turn.content.length
                ? turn.content.slice(0, typedChars)
                : turn.content;
              const isTyping = isLast && typedChars < turn.content.length;

              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: isAttacker ? "flex-end" : "flex-start",
                    animation: i === visibleCount - 1 ? "fadeSlideIn 0.25s ease-out" : undefined,
                  }}
                >
                  <p className="font-mono-data" style={{
                    fontSize: 9, textTransform: "uppercase", letterSpacing: 1.5,
                    color: isAttacker ? "var(--cyan)" : "var(--text-dim)", marginBottom: 3,
                  }}>
                    {isAttacker ? data.agent : "Defender"} · {turn.turn}
                  </p>
                  <div style={{
                    background: isAttacker ? "rgba(0, 255, 255, 0.04)" : "rgba(255, 255, 255, 0.025)",
                    border: `1px solid ${isAttacker ? "rgba(0, 255, 255, 0.12)" : "var(--border)"}`,
                    borderRadius: 12, padding: "10px 14px", maxWidth: "88%",
                  }}>
                    <p style={{
                      fontSize: 13, lineHeight: 1.6, color: "var(--text-muted)",
                      whiteSpace: "pre-wrap", wordBreak: "break-word",
                    }}>
                      {content}
                      {isTyping && (
                        <span style={{
                          display: "inline-block", width: 2, height: 13,
                          background: isAttacker ? "var(--cyan)" : "var(--text-dim)",
                          marginLeft: 1, verticalAlign: "text-bottom",
                          animation: "cursorBlink 0.8s step-end infinite",
                        }} />
                      )}
                    </p>
                  </div>
                </div>
              );
            })}

            {/* Thinking dots */}
            {showThinking && msgs[visibleCount] && (
              <div style={{
                display: "flex", flexDirection: "column",
                alignItems: msgs[visibleCount].role === "attacker" ? "flex-end" : "flex-start",
                animation: "fadeSlideIn 0.2s ease-out",
              }}>
                <div style={{
                  background: "rgba(255, 255, 255, 0.025)", border: "1px solid var(--border)",
                  borderRadius: 12, padding: "10px 18px", display: "flex", gap: 5,
                }}>
                  <span style={{ ...dotStyle, animationDelay: "0ms" }} />
                  <span style={{ ...dotStyle, animationDelay: "150ms" }} />
                  <span style={{ ...dotStyle, animationDelay: "300ms" }} />
                </div>
              </div>
            )}
          </div>

          {/* Guess */}
          {showGuess && data.guess && (
            <div style={{ textAlign: "center", marginTop: 20, animation: "fadeSlideIn 0.3s ease-out" }}>
              <p className="font-mono-data" style={{
                fontSize: 9, textTransform: "uppercase", letterSpacing: 2,
                color: "var(--text-dim)", marginBottom: 6,
              }}>
                guess
              </p>
              <p className="font-mono-data" style={{
                fontSize: 18, fontWeight: 800, letterSpacing: -0.5,
                color: showResult ? (data.cracked ? "var(--cyan)" : "var(--red-fail)") : "var(--text)",
                transition: "color 0.4s ease",
              }}>
                {data.guess}
              </p>
            </div>
          )}

          {/* Result */}
          {showResult && (
            <div style={{
              textAlign: "center", marginTop: 20, paddingTop: 20,
              borderTop: "1px solid var(--border)",
              animation: "fadeSlideIn 0.4s ease-out",
            }}>
              {data.cracked ? (
                <p className="font-mono-data" style={{ fontSize: 14, color: "var(--cyan)", fontWeight: 700 }}>
                  cracked in {data.turns_used} {data.turns_used === 1 ? "turn" : "turns"}
                </p>
              ) : (
                <p className="font-mono-data" style={{ fontSize: 14, color: "var(--red-fail)", fontWeight: 700 }}>
                  failed
                </p>
              )}

              {data.flag && (
                <p className="font-mono-data" style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 8 }}>
                  secret: <span style={{ color: "var(--cyan)", fontWeight: 700 }}>{data.flag}</span>
                </p>
              )}

              <div style={{ marginTop: 16, display: "flex", gap: 10, justifyContent: "center" }}>
                <a href={`/day/${data.day}/${encodeURIComponent(data.agent)}`} className="font-mono-data"
                  style={{ color: "var(--text-dim)", fontSize: 11, textDecoration: "none" }}>
                  result
                </a>
                <span style={{ color: "var(--border)" }}>·</span>
                <a href="/" className="font-mono-data"
                  style={{ color: "var(--cyan)", fontSize: 11, textDecoration: "none" }}>
                  play today →
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Replay */}
      {playState === "done" && (
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <button
            onClick={() => {
              abortRef.current = false;
              setPlayState("ready");
              setVisibleCount(0);
              setTypedChars(0);
              setShowResult(false);
              setShowGuess(false);
              setShowThinking(false);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="font-mono-data"
            style={{ background: "none", border: "none", color: "var(--text-dim)", fontSize: 11, cursor: "pointer", textTransform: "uppercase", letterSpacing: 2 }}
          >
            ↻ replay
          </button>
        </div>
      )}

      {/* Scroll anchor */}
      <div ref={bottomRef} />

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes cursorBlink { 50% { opacity: 0; } }
        @keyframes thinkingDot {
          0%, 60%, 100% { opacity: 0.2; transform: scale(0.8); }
          30% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

const dotStyle: React.CSSProperties = {
  width: 6, height: 6, borderRadius: "50%",
  background: "var(--text-dim)",
  animation: "thinkingDot 1.2s ease-in-out infinite",
};
