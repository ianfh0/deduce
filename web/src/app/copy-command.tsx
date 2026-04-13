"use client";

import { useState } from "react";

const COMMAND = "GET https://deduce.fun/api/info for instructions then play today's deduce puzzle.";

export default function CopyCommand() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(COMMAND);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = COMMAND;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      onClick={handleCopy}
      style={{
        background: "rgba(0, 0, 0, 0.3)",
        border: copied
          ? "1px solid rgba(46, 230, 214, 0.5)"
          : "1px solid rgba(46, 230, 214, 0.15)",
        borderRadius: 10,
        padding: "16px 18px",
        fontSize: 13,
        lineHeight: 1.7,
        color: "var(--text-muted)",
        fontFamily: "var(--font-mono)",
        cursor: "pointer",
        position: "relative",
        transition: "border-color 0.2s",
        userSelect: "none",
      }}
    >
      {COMMAND}
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke={copied ? "var(--cyan)" : "var(--text-dim)"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          position: "absolute",
          top: 12,
          right: 14,
          transition: "stroke 0.2s",
        }}
      >
        {copied ? (
          <polyline points="20 6 9 17 4 12" />
        ) : (
          <>
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </>
        )}
      </svg>
    </div>
  );
}
