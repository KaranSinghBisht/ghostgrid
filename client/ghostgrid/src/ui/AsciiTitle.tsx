// src/ui/AsciiTitle.tsx
import React, { useEffect, useRef, useState } from "react";

type Props = {
  text: string;
  size?: number;             // px
  color?: string;
  weight?: number;           // font-weight
  align?: "left" | "center" | "right";
  revealMs?: number;         // ms to fully reveal
  glitchMs?: number;         // extra scramble time
  loopGlitch?: boolean;      // tiny shimmer after reveal
  className?: string;
  style?: React.CSSProperties;
};

const CHARS = "▒░█▓/\\|_-+=<>*.#";
const randChar = () => CHARS[(Math.random() * CHARS.length) | 0];
const blankOf = (s: string) => s.replace(/[^\s]/g, " ");

export default function AsciiTitle({
  text,
  size = 64,
  color = "#e6c17b",
  weight = 900,
  align = "left",
  revealMs = 1400,
  glitchMs = 700,
  loopGlitch = false,
  className,
  style,
}: Props) {
  const [out, setOut] = useState(blankOf(text));
  const prevOut = useRef(out);

  useEffect(() => {
    setOut(blankOf(text));
  }, [text]);

    // bail on SSR without window
  const reduce =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    let raf = 0;
    let start: number | undefined;
    const letters = text.split("");

    const tick = (t: number) => {
      if (start === undefined) start = t;
      const elapsed = t - start;

      const p = reduce ? 1 : Math.min(1, elapsed / revealMs);
      const revealIdx = Math.floor(p * letters.length);
      const stillGlitch = !reduce && elapsed < revealMs + glitchMs;

      const next = letters
        .map((ch, i) => {
          if (ch === "\n") return "\n";
          if (i < revealIdx) return ch;
          if (ch === " ") return " ";
          return stillGlitch || loopGlitch ? randChar() : " ";
        })
        .join("");

      if (next !== prevOut.current) {
        prevOut.current = next;
        setOut(next);
      }

      if (!reduce && (revealIdx < letters.length || loopGlitch)) {
        raf = requestAnimationFrame(tick);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, revealMs, glitchMs, loopGlitch, reduce]);

  return (
    <div
      aria-label={text}
      className={className}
      style={{
        fontFamily:
          "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        fontSize: size,
        lineHeight: 1,
        fontWeight: weight,
        letterSpacing: 2,
        color,
        textShadow: "0 1px 0 rgba(0,0,0,.5), 0 0 18px rgba(230,193,123,.25)",
        whiteSpace: "pre-wrap",
        textAlign: align,
        ...style,
      }}
    >
      {out}
    </div>
  );
}
