import React, { useEffect, useRef, useState } from "react";
import type { MiniProps, MiniResult } from "./MiniHost";
import mapPng from "../assets/map.png";

export default function UVMini({ onComplete, onCancel }: MiniProps) {
  const [timeLeft, setTimeLeft] = useState(25);
  const [mx, setMx] = useState(120);
  const [my, setMy] = useState(80);

  const hostRef = useRef<HTMLDivElement | null>(null);

  // Pick a hidden print spot (percent coords)
  const [spot] = useState<{x:number;y:number}>(() => {
    const px = 0.70 + Math.random() * 0.2; // right side-ish
    const py = 0.25 + Math.random() * 0.5;
    return { x: px, y: py };
  });

  useEffect(() => {
    const id = setInterval(() => setTimeLeft(t => t - 1), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => { if (timeLeft <= 0) finish(false); }, [timeLeft]);

  function finish(success: boolean) {
    onComplete({ success });
  }

  function handleMove(e: React.MouseEvent) {
    const el = hostRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setMx(e.clientX - rect.left);
    setMy(e.clientY - rect.top);
  }

  const W = 480, H = 260; // playfield size
  const spotPx = { x: spot.x * W, y: spot.y * H };
  const dist = Math.hypot(mx - spotPx.x, my - spotPx.y);
  const reveal = dist < 90; // reveal radius

  function tryCapture() {
    if (reveal) finish(true);
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <TitleBar title="UV Light" onCancel={onCancel} />
      <p style={{ opacity: .9 }}>
        Sweep the room with your UV light. When a <b>handprint</b> appears, click to capture it.
      </p>

      <div style={{ fontSize: 13, opacity: .8, display: "flex", justifyContent: "space-between" }}>
        <span>Time: {timeLeft}s</span>
      </div>

      <div
        ref={hostRef}
        onMouseMove={handleMove}
        onClick={tryCapture}
        style={{
          position: "relative",
          width: W,
          height: H,
          borderRadius: 12,
          overflow: "hidden",
          border: "1px solid #262626",
          background: `center/cover url(${mapPng})`,
          cursor: "crosshair",
          boxShadow: "0 10px 40px rgba(0,0,0,.45)"
        }}
      >
        {/* Darken everything */}
        <div style={{
          position: "absolute", inset: 0,
          background: "rgba(0,0,0,.92)"
        }}/>

        {/* UV flashlight cone */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: `radial-gradient(120px 120px at ${mx}px ${my}px,
            rgba(170,120,255,0.75) 0%,
            rgba(140,100,220,0.55) 50%,
            rgba(0,0,0,0.94) 52%,
            rgba(0,0,0,0.96) 100%)`,
          mixBlendMode: "screen"
        }}/>

        {/* Handprint */}
        <div style={{
          position: "absolute",
          left: spotPx.x - 22, top: spotPx.y - 22,
          width: 44, height: 44, borderRadius: 6,
          transform: "rotate(-8deg)",
          background: "conic-gradient(from 10deg, rgba(190,140,255,.0), rgba(190,140,255,.9), rgba(190,140,255,.0))",
          boxShadow: reveal ? "0 0 18px rgba(180,130,255,.85)" : "none",
          opacity: reveal ? 1 : 0.08,
          pointerEvents: "none",
        }}/>
      </div>
    </div>
  );
}

function TitleBar({ title, onCancel }: { title: string; onCancel: () => void }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div style={{ fontWeight: 800, fontSize: 18 }}>{title}</div>
      <button onClick={onCancel} style={btnSmall}>Close</button>
    </div>
  );
}
const btnSmall: React.CSSProperties = {
  padding: "6px 10px", borderRadius: 10, border: "1px solid #2a2a2a",
  background: "#1d1d1d", color: "#eee", fontWeight: 700,
};