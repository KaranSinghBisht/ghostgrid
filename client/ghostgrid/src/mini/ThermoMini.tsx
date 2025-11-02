// src/mini/ThermoMini.tsx
import React, { useEffect, useRef, useState } from "react";
import type { MiniProps, MiniResult } from "./MiniHost";

export default function ThermoMini({ onComplete, onCancel }: MiniProps) {
  // 0..1 position of the marker (0 = freezing/left)
  const [value, setValue] = useState(0);
  const [hits, setHits] = useState(0);
  const [timeLeft, setTimeLeft] = useState(25);

  const posRef = useRef(0);   // current 0..1
  const dirRef = useRef(1);   // +1 or -1

  // robust animation loop (survives StrictMode remounts)
  useEffect(() => {
    let running = true;
    let raf = 0;
    let last = performance.now();
    const speed = 0.7; // fraction of bar per second

    const tick = () => {
      if (!running) return;
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;

      let v = posRef.current + dirRef.current * speed * dt;
      if (v >= 1) { v = 1; dirRef.current = -1; }
      if (v <= 0) { v = 0; dirRef.current = 1; }
      posRef.current = v;
      setValue(v);

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => { running = false; cancelAnimationFrame(raf); };
  }, []);

  // countdown
  useEffect(() => {
    const id = setInterval(() => setTimeLeft(s => s - 1), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => { if (timeLeft <= 0) finish(false); }, [timeLeft]);

  // target band = left (freezing)
  const targetLow = 0.02;
  const targetHigh = 0.14;

  function capture() {
    const v = posRef.current;
    const inBand = v >= targetLow && v <= targetHigh;
    if (inBand) {
      setHits(h => {
        const nh = h + 1;
        if (nh >= 3) finish(true);
        return nh;
      });
    } else {
      // small penalty for a miss
      setTimeLeft(t => Math.max(0, t - 1));
    }
  }

  function finish(success: boolean) {
    onComplete({ success, score: hits });
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 800, fontSize: 18 }}>Thermometer</div>
        <button
          onClick={onCancel}
          style={{
            padding: "6px 10px",
            borderRadius: 10,
            border: "1px solid #2a2a2a",
            background: "#1d1d1d",
            color: "#eee",
            fontWeight: 700,
          }}
        >
          Close
        </button>
      </div>

      <div style={{ opacity: 0.9 }}>
        Click when the gauge dips into the <b>freezing</b> zone. Get <b>3</b> good readings before time runs out.
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ fontSize: 13, opacity: 0.8, display: "flex", justifyContent: "space-between" }}>
          <span>Time: {timeLeft}s</span>
          <span>Hits: {hits}/3</span>
        </div>

        {/* Gauge (clickable too) */}
        <div
          onClick={capture}
          style={{
            position: "relative",
            height: 18,
            borderRadius: 12,
            background:
              "linear-gradient(90deg, rgba(120,170,255,.9) 0%, rgba(70,70,70,.35) 35%, rgba(40,40,40,.35) 100%)",
            border: "1px solid #2a2a2a",
            overflow: "visible",
            cursor: "pointer",
          }}
          title="Click to capture"
        >
          {/* target band */}
          <div
            style={{
              position: "absolute",
              left: `${targetLow * 100}%`,
              width: `${(targetHigh - targetLow) * 100}%`,
              top: 0,
              bottom: 0,
              background: "rgba(160,220,255,0.22)",
              pointerEvents: "none",
            }}
          />
          {/* marker */}
          <div
            style={{
              position: "absolute",
              left: `${value * 100}%`,
              top: -4,
              width: 26,
              height: 26,
              borderRadius: 20,
              transform: "translateX(-50%)",
              boxShadow: "0 0 14px rgba(160,220,255,0.7)",
              background: "rgba(200,230,255,0.9)",
              border: "1px solid rgba(255,255,255,0.6)",
              pointerEvents: "none",
            }}
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button
          onClick={capture}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #2a2a2a",
            background: "#1d1d1d",
            color: "#eee",
            fontWeight: 800,
          }}
        >
          Capture Reading (Space)
        </button>
      </div>

      <KeyCapture onFire={capture} />
    </div>
  );
}

// Spacebar support
function KeyCapture({ onFire }: { onFire: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") { e.preventDefault(); onFire(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onFire]);
  return null;
}