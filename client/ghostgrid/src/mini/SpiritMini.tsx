import React, { useEffect, useMemo, useState } from "react";
import type { MiniProps } from "./MiniHost";

const PHRASES = [
  "give us a sign",
  "are you with us",
  "where are you",
  "who are you",
  "why are you here",
];

export default function SpiritMini({ onComplete, onCancel }: MiniProps) {
  const target = useMemo(() => PHRASES[Math.floor(Math.random()*PHRASES.length)], []);
  const [input, setInput] = useState("");
  const [timeLeft, setTimeLeft] = useState(25);

  useEffect(() => {
    const id = setInterval(() => setTimeLeft(t => t - 1), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => { if (timeLeft <= 0) finish(false); }, [timeLeft]);

  useEffect(() => { if (input === target) finish(true); }, [input, target]);

  function finish(success:boolean){ onComplete({ success, score: success ? target.length : 0 }); }

  return (
    <div style={{ display:"grid", gap:12 }}>
      <TitleBar title="Spirit Box" onCancel={onCancel} />
      <div style={{ opacity:.9 }}>Type the phrase exactly to coax a response.</div>

      <div style={{ fontSize:13, opacity:.8, display:"flex", justifyContent:"space-between" }}>
        <span>Time: {timeLeft}s</span>
      </div>

      <div style={{
        padding:14, border:"1px solid #262626", background:"#101010", borderRadius:12, fontSize:18,
        letterSpacing:.5
      }}>
        <div style={{ color:"rgba(230,210,170,.95)", marginBottom:8 }}>&ldquo;{target}&rdquo;</div>
        <input
          autoFocus
          value={input}
          onChange={(e)=>setInput(e.target.value)}
          placeholder="speak to the box…"
          style={{
            width:"100%", padding:"10px 12px", borderRadius:10, outline:"none",
            border:"1px solid #2a2a2a", background:"#181818", color:"#eee", fontSize:16
          }}
        />
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