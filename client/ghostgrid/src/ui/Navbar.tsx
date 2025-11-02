import { Link, useLocation } from "react-router-dom";
import { useController } from "../hooks/useController";
import React from "react";

const THEME = {
  text: "#e8e0c8",
  accent: "#e6c17b",
  edge: "#241c13",
  btnBg: "#1a140e",
  btnEdge: "#2b2116",
};

const BTN: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: `1px solid ${THEME.btnEdge}`,
  background: "transparent",
  color: THEME.text,
  fontWeight: 800,
  cursor: "pointer",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,.02), 0 1px 12px rgba(0,0,0,.25)",
};
const BTN_PRIMARY: React.CSSProperties = { ...BTN, background: THEME.btnBg };
const BTN_DISABLED: React.CSSProperties = { ...BTN, opacity: 0.55, cursor: "not-allowed" };

const CONTAINER: React.CSSProperties = {
  width: "100%",         // full width
  margin: 0,
  paddingInline: 16,     // keep some side padding
  boxSizing: "border-box",
};

function linkStyle(opacity = 1): React.CSSProperties {
  return {
    color: `rgba(232,224,200,${opacity})`,
    textDecoration: "none",
    padding: "8px 10px",
    borderRadius: 10,
    border: `1px solid transparent`,
    transition: "transform .18s ease, border-color .18s ease",
    userSelect: "none",
    display: "inline-block",
  };
}

export default function NavBar({ showHowLink = false }: { showHowLink?: boolean }) {
  const { address, connecting, connect, disconnect } = useController();
  const short = (a?: string | null) => (a ? a.slice(0, 6) + "…" + a.slice(-4) : "");
  const { pathname } = useLocation();

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        backdropFilter: "blur(8px)",
        background: "rgba(11,10,9,.55)",
        borderBottom: `1px solid ${THEME.edge}`,
      }}
    >
      <div style={{ ...CONTAINER, display: "flex", alignItems: "center", justifyContent: "space-between", padding: 12 }}>
        <Link to="/" style={{ textDecoration: "none", color: THEME.accent }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 900 }}>
            <span role="img" aria-label="pumpkin">🎃</span>
            <span>Ghost Grid</span>
          </div>
        </Link>

        <nav className="gg-nav-links" style={{ display: "flex", gap: 14, alignItems: "center", opacity: 0.9 }}>
          {showHowLink && pathname === "/" && <a href="#how" style={linkStyle()}>How it works</a>}
          <Link to="/play" style={linkStyle()}>Play</Link>
          <Link to="/leaderboard" style={linkStyle()}>Leaderboard</Link>
          <a href="https://github.com/dojoengine/dojo-intro" target="_blank" rel="noreferrer" style={linkStyle()}>Dojo</a>
          <a href="https://docs.cartridge.gg" target="_blank" rel="noreferrer" style={linkStyle()}>Cartridge</a>
        </nav>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {address ? (
            <>
              <span style={{ opacity: .9, fontWeight: 700, fontSize: 13 }}>{short(address)}</span>
              <button style={BTN} onClick={disconnect}>Sign out</button>
            </>
          ) : (
            <button style={connecting ? BTN_DISABLED : BTN_PRIMARY} disabled={connecting} onClick={connect}>
              {connecting ? "Connecting…" : "Sign in"}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}