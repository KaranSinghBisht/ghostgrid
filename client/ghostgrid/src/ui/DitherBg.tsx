// src/ui/DitherBg.tsx
import React, { useEffect } from "react";

type Props = {
  tint?: string;       // base hue
  grain?: number;      // 2..8
  vignette?: number;   // 0..1
  animate?: boolean;
  speedSec?: number;   // pan speed
  style?: React.CSSProperties;
  children?: React.ReactNode;
};

let injected = false;
function injectKeyframes() {
  if (injected) return;
  const css = `
@keyframes gg-pan {
  0%   { transform: translate3d(0,0,0) }
  100% { transform: translate3d(-25%, -25%, 0) }
}
@keyframes gg-grain {
  0%   { transform: translate3d(0,0,0) }
  100% { transform: translate3d(-6%, 4%, 0) }
}
@media (prefers-reduced-motion: reduce) {
  * { animation: none !important }
}`;
  const s = document.createElement("style");
  s.id = "gg-anim-keyframes";
  s.textContent = css;
  document.head.appendChild(s);
  injected = true;
}

export default function DitherBg({
  tint = "#e6c17b",
  grain = 4,
  vignette = 0.7,
  animate = true,
  speedSec = 14,
  style,
  children,
}: Props) {
  useEffect(() => { injectKeyframes(); }, []);
  const tintRgb = hexToRgb(tint) ?? { r: 230, g: 193, b: 123 };

  return (
    <div style={{ position: "relative", overflow: "hidden", ...style }}>
      {/* sepia wash */}
      <div
        aria-hidden
        style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: `linear-gradient(180deg, rgba(${tintRgb.r},${tintRgb.g},${tintRgb.b},0.07), rgba(0,0,0,0.36))`,
        }}
      />
      {/* DITHER: cross-hatch grid (oversized + animated pan) */}
      <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", mixBlendMode: "multiply" as any }}>
        <div
          style={{
            position: "absolute",
            top: "-50%", left: "-50%",
            width: "200%", height: "200%",
            background:
              // four interleaved diagonals for a denser dither
              `repeating-linear-gradient(45deg, rgba(0,0,0,.20) 0 ${grain}px, transparent ${grain}px ${grain*2}px),
               repeating-linear-gradient(-45deg, rgba(0,0,0,.20) 0 ${grain}px, transparent ${grain}px ${grain*2}px),
               repeating-linear-gradient(45deg, rgba(255,255,255,.06) 0 ${grain}px, transparent ${grain}px ${grain*2}px),
               repeating-linear-gradient(-45deg, rgba(255,255,255,.06) 0 ${grain}px, transparent ${grain}px ${grain*2}px)`,
            opacity: 0.55,
            animation: animate ? `gg-pan ${speedSec}s linear infinite` : undefined,
            willChange: "transform",
          }}
        />
      </div>
      {/* film grain (slow drift) */}
      <div
        aria-hidden
        style={{
          position: "absolute", inset: -200, pointerEvents: "none",
          background:
            "radial-gradient(1px 1px at 10% 20%, rgba(0,0,0,.15) 1px, transparent 1px)," +
            "radial-gradient(1px 1px at 30% 80%, rgba(0,0,0,.12) 1px, transparent 1px)," +
            "radial-gradient(1px 1px at 70% 40%, rgba(0,0,0,.14) 1px, transparent 1px)," +
            "radial-gradient(1px 1px at 90% 70%, rgba(0,0,0,.12) 1px, transparent 1px)",
          backgroundSize: "120px 120px, 140px 140px, 160px 160px, 180px 180px",
          opacity: 0.35,
          filter: "blur(.2px)",
          animation: animate ? "gg-grain 10s steps(60) infinite alternate" : undefined,
          willChange: "transform",
        }}
      />
      {/* vignette */}
      <div
        aria-hidden
        style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: `radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 40%, rgba(0,0,0,${vignette}) 100%)`,
        }}
      />
      {/* content */}
      <div style={{ position: "relative" }}>{children}</div>
    </div>
  );
}

function hexToRgb(hex: string) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  return m ? { r: parseInt(m[1],16), g: parseInt(m[2],16), b: parseInt(m[3],16) } : null;
}