import React, { useEffect, useState } from "react";
import type { MiniProps } from "./MiniHost";

export default function PropMini({ onComplete, onCancel }: MiniProps) {
  const [timeLeft, setTimeLeft] = useState(20);
  const [hits, setHits] = useState(0);
  const [pos, setPos] = useState<{x:number;y:number}>({ x: 80, y: 60 });

  useEffect(() => {
    const id = setInterval(() => setTimeLeft(t => t - 1), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => { if (timeLeft <= 0) finish(false); }, [timeLeft]);

  // teleporting orb (slower)
  useEffect(() => {
    const id = setInterval(() => {
      setPos({ x: 40 + Math.random()*360, y: 30 + Math.random()*150 });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  function finish(success:boolean){ onComplete({ success, score: hits }); }

  function onClickField(e: React.MouseEvent<HTMLDivElement>) {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const d = Math.hypot(mx - pos.x, my - pos.y);
    if (d <= 18) {
      setHits(h => {
        const nh = h + 1;
        if (nh >= 5) finish(true);
        return nh;
      });
    } else {
      setTimeLeft(t => Math.max(0, t - 1));
    }
  }

  return (
    <div style={{ display:"grid", gap:12 }}>
      <TitleBar title="Poltergeist Activity" onCancel={onCancel} />
      <div style={{ opacity:.9 }}>Click the moving orb <b>5</b> times.</div>

      <div style={{ fontSize:13, opacity:.8, display:"flex", justifyContent:"space-between" }}>
        <span>Time: {timeLeft}s</span>
        <span>Hits: {hits}/5</span>
      </div>

      <div
        onClick={onClickField}
        style={{
          position:"relative", width:420, height:210, borderRadius:12,
          border:"1px solid #262626", background:"#0f0f0f", overflow:"hidden", cursor:"crosshair"
        }}
      >
        <div style={{
          position:"absolute", left: pos.x-18, top: pos.y-18, width:36, height:36, borderRadius:20,
          background:"radial-gradient(circle, rgba(230,210,170,.95), rgba(230,210,170,.4) 60%, rgba(230,210,170,0) 70%)",
          boxShadow:"0 0 28px rgba(230,210,170,.5), inset 0 0 16px rgba(255,255,255,.8)",
          pointerEvents:"none"
        }}/>
      </div>
    </div>
  );
}

function TitleBar({ title, onCancel }: { title: string; onCancel: () => void }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
      <div style={{ fontWeight:800, fontSize:18 }}>{title}</div>
      <button onClick={onCancel} style={btnSmall}>Close</button>
    </div>
  );
}
const btnSmall: React.CSSProperties = { padding:"6px 10px", borderRadius:10, border:"1px solid #2a2a2a", background:"#1d1d1d", color:"#eee", fontWeight:700 };