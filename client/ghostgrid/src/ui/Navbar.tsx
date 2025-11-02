// src/ui/Navbar.tsx
import React, { useState } from "react";
import { useController } from "../hooks/useController";

const THEME = { text: "#e8e0c8", muted: "#b9aa86", edge: "#241c13" };

export default function Navbar() {
  const { address, sessionActive, connect, startSession } = useController();
  const [busy, setBusy] = useState(false);

  const short = (a?: string | null) => (a ? a.slice(0, 6) + "…" + a.slice(-4) : "");

  return (
    <nav
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 16px",
        borderBottom: `1px solid ${THEME.edge}`,
        color: THEME.text,
        background: "rgba(12,10,8,.6)",
        backdropFilter: "blur(6px)",
        boxSizing: "border-box",
      }}
    >
      <a href="/" style={{ fontWeight: 800, textDecoration: "none", color: THEME.text }}>
        GHOST GRID
      </a>

      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <a href="/play" style={link()}>Play</a>
        <a href="/leaderboard" style={link()}>Leaderboard</a>
        <a href="https://cartridge.gg" target="_blank" rel="noreferrer" style={link()}>Cartridge</a>

        <span style={{ color: THEME.muted, fontFamily: "ui-monospace, Menlo, monospace" }}>
          {address ? short(address) : "Not connected"}
        </span>

        {!address && (
          <button
            style={btn()}
            disabled={busy}
            onClick={async () => { setBusy(true); try { await connect(); } finally { setBusy(false); } }}
          >
            {busy ? "Connecting…" : "Connect"}
          </button>
        )}

        {address && !sessionActive && (
          <button
            style={btn(true)}
            disabled={busy}
            onClick={async () => { setBusy(true); try { await startSession(); } finally { setBusy(false); } }}
          >
            {busy ? "Starting…" : "Start Session"}
          </button>
        )}
      </div>
    </nav>
  );
}

function link(): React.CSSProperties {
  return { color: "#e8e0c8", textDecoration: "none", opacity: 0.9 };
}
function btn(primary = false): React.CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 10,
    border: `1px solid #241c13`,
    background: primary ? "#1b160f" : "transparent",
    color: "#e8e0c8",
    cursor: "pointer",
  };
}