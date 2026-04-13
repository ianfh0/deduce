"use client";

import { useState } from "react";

const COMMAND = "Read https://deduce.fun/skill.md and play today's deduce puzzle.";

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
      <span
        className="font-mono-data"
        style={{
          position: "absolute",
          top: 10,
          right: 14,
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: 1,
          color: copied ? "var(--cyan)" : "var(--text-dim)",
          transition: "color 0.2s",
        }}
      >
        {copied ? "copied" : "copy"}
      </span>
    </div>
  );
}
