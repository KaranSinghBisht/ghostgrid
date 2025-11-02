import React, { useEffect, useMemo, useState } from "react";
import type { MiniProps } from "./MiniHost";

const LINES = [
  "the walls remember our names",
  "leave this place while you can",
  "cold breath trails through the halls",
];

export default function WritingMini({ onComplete, onCancel }: MiniProps) {
  const target = useMemo(() => LINES[Math.floor(Math.random()*LINES.length)], []);
  const [input, setInput] = useState("");
  const [timeLeft, setTimeLeft] = useState(30);
  const [errors, setErrors] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTimeLeft(t => t - 1), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => { if (timeLeft <= 0) finish(false); }, [timeLeft]);

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    // Count new errors vs ground truth
    let err = 0;
    for (let i=0; i<Math.min(v.length, target.length); i++) {
      if (v[i] !== target[i]) err++;
    }
    setErrors(err);
    setInput(v);
    if (v === target && err <= 2) finish(true);
  }

  function finish(success:boolean){ onComplete({ success, score: success ? target.length - errors : 0 }); }

  return (
    <div style={{ display:"grid", gap:12 }}>
      <TitleBar title="Ghost Writing" onCancel={onCancel} />
      <div style={{ opacity:.9 }}>Copy the inscription with ≤2 mistakes.</div>

      <div style={{ fontSize:13, opacity:.8, display:"flex", justifyContent:"space-between" }}>
        <span>Time: {timeLeft}s</span>
        <span>Errors: {errors}/2</span>
      </div>

      <div style={{
        padding:14, border:"1px solid #262626", background:"#101010", borderRadius:12,
        fontSize:18, letterSpacing:.3
      }}>
        <div style={{ color:"rgba(230,210,170,.95)", marginBottom:8 }}>&ldquo;{target}&rdquo;</div>
        <input
          autoFocus value={input} onChange={onChange}
          placeholder="the chalk whispers…"
          style={{ width:"100%", padding:"10px 12px", borderRadius:10, outline:"none",
          border:"1px solid #2a2a2a", background:"#181818", color:"#eee", fontSize:16 }}
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