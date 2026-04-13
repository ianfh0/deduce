"use client";

import { useState, useRef, useEffect } from "react";

export default function Expandable({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>(
    defaultOpen ? undefined : 0
  );

  useEffect(() => {
    if (!contentRef.current) return;
    if (open) {
      const h = contentRef.current.scrollHeight;
      setHeight(h);
      // After transition, remove fixed height so content can reflow
      const timer = setTimeout(() => setHeight(undefined), 350);
      return () => clearTimeout(timer);
    } else {
      // Set current height first so browser can transition from it
      setHeight(contentRef.current.scrollHeight);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setHeight(0));
      });
    }
  }, [open]);

  return (
    <div style={{ marginTop: 32 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          background: "none",
          border: "none",
          padding: "8px 0",
          cursor: "pointer",
        }}
      >
        <h2 style={{
          fontSize: 20,
          fontWeight: 700,
          color: "var(--text)",
          margin: 0,
        }}>
          {title}
        </h2>
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          color: "var(--text-dim)",
          transition: "color 0.2s ease",
          letterSpacing: 1,
          textTransform: "uppercase",
          fontFamily: "var(--font-dm-mono)",
        }}>
          {open ? "−" : "+"}
        </span>
      </button>
      <div
        ref={contentRef}
        style={{
          overflow: "hidden",
          height: height === undefined ? "auto" : height,
          opacity: open ? 1 : 0,
          transition: "height 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease",
          paddingTop: open ? 8 : 0,
        }}
      >
        {children}
      </div>
    </div>
  );
}
