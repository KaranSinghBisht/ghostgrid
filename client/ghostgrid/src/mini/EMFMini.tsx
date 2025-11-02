import React, { useEffect, useRef, useState } from "react";
import type { MiniProps } from "./MiniHost";

export default function EMFMini({ onComplete, onCancel }: MiniProps) {
  // single long spike mini
  const [timeLeft, setTimeLeft] = useState(18);
  const [values, setValues] = useState<number[]>(Array(10).fill(0.1));
  const [phase, setPhase] = useState<"idle" | "spike">("idle");
  const capturedRef = useRef(false);
  const timers = useRef<number[]>([]);

  // countdown
  useEffect(() => {
    const id = window.setInterval(() => setTimeLeft((t) => t - 1), 1000);
    timers.current.push(id);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (timeLeft <= 0 && !capturedRef.current) finish(false);
  }, [timeLeft]);

  // phase machine: 1) idle for ~2s  2) spike for 3.5s  -> fail if not captured
  useEffect(() => {
    enterIdle(2000);
    return cleanupAll;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function enterIdle(ms: number) {
    setPhase("idle");
    const to = window.setTimeout(() => enterSpike(3500), ms);
    timers.current.push(to);
  }
  function enterSpike(ms: number) {
    setPhase("spike");
    const to = window.setTimeout(() => {
      if (!capturedRef.current) finish(false);
    }, ms);
    timers.current.push(to);
  }

  // animate bars
  useEffect(() => {
    const id = window.setInterval(() => {
      const now = Date.now();
      setValues(
        Array.from({ length: 10 }, (_, i) => {
          if (phase === "idle") {
            const base =
              0.15 + 0.06 * Math.sin(now / 700 + i * 0.8) + (Math.random() - 0.5) * 0.08;
            return clamp(base, 0.05, 0.45);
          } else {
            // high, slowly undulating spike
            const base =
              0.84 + 0.10 * Math.sin(now / 900 + i * 0.6) + (Math.random() - 0.5) * 0.04;
            return clamp(base, 0.8, 1);
          }
        })
      );
    }, 120); // slower & readable
    timers.current.push(id);
    return () => clearInterval(id);
  }, [phase]);

  function capture() {
    // Only one success, only during spike
    if (phase === "spike" && !capturedRef.current) {
      capturedRef.current = true;
      finish(true);
    }
  }

  function finish(success: boolean) {
    cleanupAll();
    onComplete({ success, score: success ? 1 : 0 });
  }
  function cleanupAll() {
    timers.current.forEach((t) => {
      // works for intervals & timeouts in browser
      clearTimeout(t);
      clearInterval(t);
    });
    timers.current = [];
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <TitleBar title="EMF Reader" onCancel={onCancel} />
      <div style={{ opacity: 0.9 }}>
        Watch for a <b>long spike</b> (3–4s) and hit capture <b>once</b>.
      </div>

      <div style={{ fontSize: 13, opacity: 0.8, display: "flex", justifyContent: "space-between" }}>
        <span>Time: {timeLeft}s</span>
        <span>Target: 1 spike</span>
      </div>

      {/* meter */}
      <div
        onClick={capture}
        title="Click to capture"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(10, 1fr)",
          gap: 6,
          padding: 12,
          background: "#0f0f0f",
          border: "1px solid #262626",
          borderRadius: 12,
          cursor: "pointer",
        }}
      >
        {values.map((v, i) => (
          <div
            key={i}
            style={{
              height: 120,
              borderRadius: 8,
              background: "linear-gradient(180deg,#444,#222)",
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                height: `${Math.round(v * 100)}%`,
                borderRadius: 8,
                background: v >= 0.8 ? "rgba(120,255,140,.9)" : "rgba(160,200,255,.8)",
                boxShadow: v >= 0.8 ? "0 0 16px rgba(120,255,140,.5)" : "0 0 10px rgba(120,170,255,.35)",
                transition: "height 100ms linear",
              }}
            />
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button onClick={capture} style={btnPrimary}>
          Capture (Space)
        </button>
      </div>

      <KeyCapture onFire={capture} />
    </div>
  );
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function TitleBar({ title, onCancel }: { title: string; onCancel: () => void }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div style={{ fontWeight: 800, fontSize: 18 }}>{title}</div>
      <button onClick={onCancel} style={btnSmall}>
        Close
      </button>
    </div>
  );
}
const btnSmall: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 10,
  border: "1px solid #2a2a2a",
  background: "#1d1d1d",
  color: "#eee",
  fontWeight: 700,
};
const btnPrimary: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #2a2a2a",
  background: "#1d1d1d",
  color: "#eee",
  fontWeight: 800,
};

function KeyCapture({ onFire }: { onFire: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        onFire();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onFire]);
  return null;
}