// src/Home.tsx
import { Link } from "react-router-dom";
import AsciiTitle from "./ui/AsciiTitle";
import PixelCard from "./ui/PixelCard";
import Navbar from "./ui/Navbar";
import R3FDither from "./ui/R3FDither";

const THEME = {
  bg: "#0b0a09",
  text: "#e8e0c8",
  textMuted: "#b9aa86",
  accent: "#e6c17b",
  panel: "#12100d",
  edge: "#241c13",
  btnBg: "#1a140e",
  btnEdge: "#2b2116",
};

const BTN: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: 12,
  border: `1px solid ${THEME.btnEdge}`,
  background: "transparent",
  color: THEME.text,
  fontWeight: 800,
  cursor: "pointer",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,.02), 0 1px 12px rgba(0,0,0,.25)",
};
const BTN_PRIMARY: React.CSSProperties = { ...BTN, background: THEME.btnBg };

const PANEL: React.CSSProperties = {
  background: THEME.panel,
  border: `1px solid ${THEME.edge}`,
  borderRadius: 16,
  boxShadow: "0 24px 60px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.02)",
};

const CONTAINER: React.CSSProperties = { width: "min(1100px, 100%)", margin: "0 auto" };

export default function Home() {
  return (
    <>
      <R3FDither pixelSize={1.1} colorNum={10} waveAmplitude={0.15} waveSpeed={0.03} opacity={0.5} />

      <style>{`
        @media (max-width: 980px) {
          .gg-hero { grid-template-columns: 1fr !important; }
          .gg-features { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div
        style={{
          minHeight: "100dvh",
          color: THEME.text,
          background: "transparent",
          fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto",
          position: "relative",
          display: "grid",
          gridTemplateRows: "auto auto auto",
          zIndex: 1,
        }}
      >
        <Navbar showHowLink />

        <main style={{ display: "grid", placeItems: "center", padding: "24px 24px 0", gap: 18 }}>
          {/* HERO */}
          <div style={{ ...PANEL, ...CONTAINER, padding: 24 }}>
            <div className="gg-hero" style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 24, alignItems: "center" }}>
              <div style={{ display: "grid", placeItems: "center" }}>
                <img
                  src="/logo.png"
                  alt="Ghost Grid"
                  style={{
                    width: "100%",
                    maxWidth: 380,
                    borderRadius: 12,
                    filter: "contrast(1.05) saturate(0.9) drop-shadow(0 10px 30px rgba(0,0,0,.6))",
                  }}
                />
              </div>
              <div style={{ display: "grid", gap: 14 }}>
                <AsciiTitle text={"GHOST\nGRID"} size={68} align="left" />
                <div style={{ opacity: 0.95, lineHeight: 1.7, marginTop: 6, textAlign: "left" }}>
                  Hunt the entity, lock the evidence, and guess the ghost. Each tool is a tiny minigame;
                  success triggers an on-chain action. Find the 2×2 room (you’ll hear a heartbeat), gather any three
                  evidences, then make your call.
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 6 }}>
                  <Link to="/play" style={{ textDecoration: "none" }}>
                    <button style={{ ...BTN_PRIMARY, fontSize: 18 }}>Play now</button>
                  </Link>
                  <a href="#how" style={{ textDecoration: "none" }}>
                    <button style={BTN}>How it works</button>
                  </a>
                  <a href="https://github.com/dojoengine/dojo-intro" target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                    <button style={BTN}>Built with Dojo</button>
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* FEATURES */}
          <div className="gg-features" style={{ ...CONTAINER, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            <PixelCard title="On-chain gameplay">
              Each tool you use submits a transaction. We gate tools by proximity so it feels fair,
              then poll until Torii confirms the evidence state.
            </PixelCard>
            <PixelCard title="Cartridge login">
              Single-click sign-in with Controller. We’ll hook this into a global leaderboard with
              address-scoped stats next.
            </PixelCard>
            <PixelCard title="Fast minigames">
              Thermo, EMF (long spike), UV, Writing, Spirit Box, and Prop. Short, readable, and tuned
              for 10–20s runs.
            </PixelCard>
          </div>

          {/* HOW-TO */}
          <div id="how" style={{ ...PANEL, ...CONTAINER, padding: 16, marginBottom: 0 }}>
            <div style={{ fontWeight: 900, fontSize: 20, color: THEME.accent, marginBottom: 8 }}>How to play</div>
            <ul style={{ margin: 0, paddingLeft: 18, opacity: 0.95, lineHeight: 1.7 }}>
              <li>Move around the house; find the ghost room (2×2) — heartbeat will play inside.</li>
              <li>Open a tool, beat the minigame, and watch for the on-chain “Evidence found” toast.</li>
              <li>Collect any 3 → open the report → select a ghost → submit your final guess.</li>
            </ul>
          </div>
        </main>

        {/* FOOTER */}
        <footer
          style={{
            position: "relative",
            borderTop: `1px solid ${THEME.edge}`,
            background: "rgba(18,16,13,.6)",
            backdropFilter: "blur(6px)",
            marginTop: 0,
          }}
        >
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: -24,
              height: 24,
              background: "linear-gradient(180deg, rgba(11,10,9,.0) 0%, rgba(11,10,9,.6) 100%)",
              pointerEvents: "none",
            }}
          />
          <div style={{ ...CONTAINER, padding: 16, display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 12 }}>
            <div style={{ opacity: 0.85, fontSize: 12 }}>© {new Date().getFullYear()} Ghost Grid</div>
            <div style={{ textAlign: "center", fontWeight: 700, color: THEME.accent, letterSpacing: 0.3 }}>
              Dojo + Cartridge demo
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", fontSize: 12 }}>
              <a href="https://github.com/dojoengine/dojo-intro" target="_blank" rel="noreferrer" style={{ color: THEME.text, textDecoration: "none", opacity: .85 }}>GitHub</a>
              <a href="https://docs.cartridge.gg" target="_blank" rel="noreferrer" style={{ color: THEME.text, textDecoration: "none", opacity: .85 }}>Docs</a>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}