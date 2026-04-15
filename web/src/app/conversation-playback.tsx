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

const CHAR_DELAY = 12;       // ms per character while "typing"
const PAUSE_BETWEEN = 600;   // pause between messages
const THINKING_MIN = 400;    // minimum "thinking" time
const THINKING_MAX = 1200;   // maximum "thinking" time

export default function ConversationPlayback({ sessionId, token }: { sessionId: string; token?: string }) {
  const [data, setData] = useState<PlaybackData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playState, setPlayState] = useState<PlayState>("loading");

  // which messages are visible, and how many chars of the current one
  const [visibleCount, setVisibleCount] = useState(0);
  const [typedChars, setTypedChars] = useState(0);
  const [showThinking, setShowThinking] = useState(false);
  const [showResult, setShowResult] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef(false);
  const speedRef = useRef(1); // 1x, 2x, 4x

  // fetch data
  useEffect(() => {
    const params = new URLSearchParams({ s: sessionId });
    if (token) params.set("t", token);

    fetch(`/api/playback?${params}`)
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
  }, [sessionId, token]);

  const scrollToBottom = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, []);

  // the animation loop
  const play = useCallback(async () => {
    if (!data) return;
    abortRef.current = false;
    setPlayState("playing");
    setVisibleCount(0);
    setTypedChars(0);
    setShowResult(false);

    const msgs = data.conversation;

    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        const adjusted = ms / speedRef.current;
        setTimeout(resolve, adjusted);
      });

    for (let i = 0; i < msgs.length; i++) {
      if (abortRef.current) return;

      // show "thinking" indicator
      setShowThinking(true);
      scrollToBottom();
      const thinkTime = THINKING_MIN + Math.random() * (THINKING_MAX - THINKING_MIN);
      await sleep(thinkTime);
      if (abortRef.current) return;
      setShowThinking(false);

      // stream characters
      const content = msgs[i].content;
      setVisibleCount(i + 1);
      setTypedChars(0);

      for (let c = 0; c <= content.length; c++) {
        if (abortRef.current) return;
        setTypedChars(c);
        if (c < content.length) {
          await sleep(CHAR_DELAY);
        }
      }

      scrollToBottom();

      // pause between messages
      if (i < msgs.length - 1) {
        await sleep(PAUSE_BETWEEN);
      }
    }

    // show result card
    await sleep(800);
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
      setShowResult(true);
      setPlayState("done");
    }
  }, [data]);

  const cycleSpeed = useCallback(() => {
    speedRef.current = speedRef.current >= 4 ? 1 : speedRef.current * 2;
    // force re-render for the button label
    setTypedChars((c) => c);
  }, []);

  if (error) {
    return (
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "56px 40px 60px", textAlign: "center" }}>
        <h1 className="font-display" style={{ fontSize: 42, fontWeight: 800, color: "var(--cyan)", letterSpacing: -1.5 }}>
          deduce
        </h1>
        <p className="font-mono-data" style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 24 }}>
          {error}
        </p>
        <a href="/" style={{ color: "var(--cyan)", textDecoration: "none", fontSize: 13, marginTop: 16, display: "inline-block" }}>
          ← back to today
        </a>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "56px 40px 60px", textAlign: "center" }}>
        <h1 className="font-display" style={{ fontSize: 42, fontWeight: 800, color: "var(--cyan)", letterSpacing: -1.5 }}>
          deduce
        </h1>
        <div style={{ marginTop: 40 }}>
          <div className="skeleton" style={{ height: 20, width: 200, margin: "0 auto" }} />
          <div className="skeleton" style={{ height: 14, width: 140, margin: "12px auto 0" }} />
        </div>
      </div>
    );
  }

  const msgs = data.conversation;

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "56px 24px 60px" }}>
      {/* Header */}
      <div style={{ textAlign: "center" }}>
        <a href="/" style={{ textDecoration: "none" }}>
          <h1 className="font-display" style={{ fontSize: 42, fontWeight: 800, letterSpacing: -1.5, color: "var(--cyan)" }}>
            deduce
          </h1>
        </a>
        <p className="font-mono-data" style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 6, textTransform: "uppercase", letterSpacing: 2 }}>
          day {data.day} — playback
        </p>
      </div>

      {/* Match info */}
      <div className="game-card" style={{ padding: "20px 24px", marginTop: 24, textAlign: "center" }}>
        <a href={`/agent/${encodeURIComponent(data.agent)}`} style={{ textDecoration: "none" }}>
          <p className="font-mono-data" style={{ fontSize: 20, fontWeight: 800, color: "var(--text)", letterSpacing: -0.5 }}>
            {data.agent}
          </p>
        </a>
        <p className="font-mono-data" style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
          {data.agent_model} vs {data.defender_model} defender
        </p>
        <p style={{ fontSize: 13, lineHeight: 1.7, color: "var(--text-muted)", fontStyle: "italic", marginTop: 10 }}>
          &ldquo;{data.briefing}&rdquo;
        </p>
      </div>

      {/* Play button / controls */}
      {playState === "ready" && (
        <div style={{ textAlign: "center", marginTop: 20 }}>
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
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(46, 230, 214, 0.18)";
              e.currentTarget.style.borderColor = "rgba(46, 230, 214, 0.5)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(46, 230, 214, 0.1)";
              e.currentTarget.style.borderColor = "rgba(46, 230, 214, 0.3)";
            }}
          >
            ▶ watch replay
          </button>
        </div>
      )}

      {/* Playing controls */}
      {playState === "playing" && (
        <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 16 }}>
          <button
            onClick={cycleSpeed}
            className="font-mono-data"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "8px 16px",
              color: "var(--text-muted)",
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            {speedRef.current}x
          </button>
          <button
            onClick={skipToEnd}
            className="font-mono-data"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "8px 16px",
              color: "var(--text-muted)",
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            skip →
          </button>
        </div>
      )}

      {/* Conversation area */}
      {(playState === "playing" || playState === "done") && (
        <div
          ref={containerRef}
          style={{
            marginTop: 16,
            maxHeight: "60vh",
            overflowY: "auto",
            scrollbarWidth: "none",
          }}
        >
          <div className="game-card" style={{ padding: "20px 20px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
                      opacity: 1,
                      animation: i === visibleCount - 1 ? "fadeSlideIn 0.25s ease-out" : undefined,
                    }}
                  >
                    <p className="font-mono-data" style={{
                      fontSize: 9,
                      textTransform: "uppercase",
                      letterSpacing: 1.5,
                      color: isAttacker ? "var(--cyan)" : "var(--text-dim)",
                      marginBottom: 4,
                    }}>
                      {isAttacker ? data.agent : "Defender"} — turn {turn.turn}
                    </p>
                    <div style={{
                      background: isAttacker
                        ? "rgba(0, 255, 255, 0.05)"
                        : "rgba(255, 255, 255, 0.03)",
                      border: `1px solid ${isAttacker ? "rgba(0, 255, 255, 0.15)" : "var(--border)"}`,
                      borderRadius: 12,
                      padding: "12px 16px",
                      maxWidth: "85%",
                    }}>
                      <p style={{
                        fontSize: 13,
                        lineHeight: 1.65,
                        color: "var(--text-muted)",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}>
                        {content}
                        {isTyping && (
                          <span
                            style={{
                              display: "inline-block",
                              width: 2,
                              height: 14,
                              background: isAttacker ? "var(--cyan)" : "var(--text-dim)",
                              marginLeft: 1,
                              verticalAlign: "text-bottom",
                              animation: "cursorBlink 0.8s step-end infinite",
                            }}
                          />
                        )}
                      </p>
                    </div>
                  </div>
                );
              })}

              {/* Thinking indicator */}
              {showThinking && (
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: visibleCount % 2 === 0
                    ? (msgs[visibleCount]?.role === "attacker" ? "flex-end" : "flex-start")
                    : (msgs[visibleCount]?.role === "attacker" ? "flex-end" : "flex-start"),
                  animation: "fadeSlideIn 0.2s ease-out",
                }}>
                  <div style={{
                    background: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    padding: "12px 20px",
                    display: "flex",
                    gap: 5,
                  }}>
                    <span style={{ ...dotStyle, animationDelay: "0ms" }} />
                    <span style={{ ...dotStyle, animationDelay: "150ms" }} />
                    <span style={{ ...dotStyle, animationDelay: "300ms" }} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Result reveal */}
          {showResult && (
            <div
              className="game-card"
              style={{
                padding: "24px 24px",
                marginTop: 12,
                textAlign: "center",
                animation: "fadeSlideIn 0.4s ease-out",
              }}
            >
              {data.cracked ? (
                <>
                  <p style={{ fontSize: 40, fontWeight: 800, color: "var(--cyan)", letterSpacing: -2, lineHeight: 1 }}>
                    {data.turns_used}
                  </p>
                  <p className="font-mono-data" style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 6, textTransform: "uppercase", letterSpacing: 2 }}>
                    {data.turns_used === 1 ? "turn" : "turns"} to crack
                  </p>
                </>
              ) : (
                <p style={{ fontSize: 28, fontWeight: 800, color: "var(--red-fail)", lineHeight: 1 }}>
                  failed
                </p>
              )}

              {data.flag && (
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
                  <p className="font-mono-data" style={{ fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 2 }}>
                    Secret
                  </p>
                  <p className="font-mono-data" style={{ fontSize: 18, fontWeight: 800, color: "var(--cyan)", marginTop: 4 }}>
                    {data.flag}
                  </p>
                  {data.guess && (
                    <p className="font-mono-data" style={{ fontSize: 11, color: data.cracked ? "var(--cyan)" : "var(--red-fail)", marginTop: 8 }}>
                      guessed: {data.guess}
                    </p>
                  )}
                </div>
              )}

              <div style={{ marginTop: 16, display: "flex", gap: 10, justifyContent: "center" }}>
                <a
                  href={`/day/${data.day}/${encodeURIComponent(data.agent)}`}
                  className="font-mono-data"
                  style={{
                    color: "var(--text-muted)",
                    fontSize: 11,
                    textDecoration: "none",
                    padding: "8px 14px",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                  }}
                >
                  full result
                </a>
                <a
                  href="/"
                  className="font-mono-data"
                  style={{
                    color: "var(--cyan)",
                    fontSize: 11,
                    textDecoration: "none",
                    padding: "8px 14px",
                    border: "1px solid rgba(46, 230, 214, 0.25)",
                    borderRadius: 8,
                  }}
                >
                  play today →
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Replay button when done */}
      {playState === "done" && (
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <button
            onClick={() => {
              abortRef.current = false;
              setPlayState("ready");
              setVisibleCount(0);
              setTypedChars(0);
              setShowResult(false);
              setShowThinking(false);
            }}
            className="font-mono-data"
            style={{
              background: "none",
              border: "none",
              color: "var(--text-dim)",
              fontSize: 11,
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: 2,
            }}
          >
            ↻ replay
          </button>
        </div>
      )}

      {/* CSS animations injected inline */}
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes cursorBlink {
          50% { opacity: 0; }
        }
        @keyframes thinkingDot {
          0%, 60%, 100% { opacity: 0.2; transform: scale(0.8); }
          30% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

const dotStyle: React.CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: "50%",
  background: "var(--text-dim)",
  animation: "thinkingDot 1.2s ease-in-out infinite",
};
