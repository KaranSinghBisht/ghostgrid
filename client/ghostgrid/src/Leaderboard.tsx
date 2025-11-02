// src/Leaderboard.tsx
import React from "react";
import R3FDither from "./ui/R3FDither";
import Navbar from "./ui/Navbar";
import GhostProfileCard from "./ui/GhostProfileCard";
import LeaderboardTable from "./ui/LeaderboardTable";
import { useController } from "./hooks/useController";

const THEME = { text: "#e8e0c8" };

// Full-bleed page wrapper (stretches edge-to-edge)
const WRAPPER: React.CSSProperties = {
  minHeight: "100svh",
  color: THEME.text,
  background: "transparent",
  fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto",
  position: "relative",
  display: "grid",
  gridTemplateRows: "auto 1fr",
  width: "100%",
  margin: 0,
  overflowX: "hidden",
  boxSizing: "border-box",
};

// Centered inner container (content width + centering)
const MAIN: React.CSSProperties = {
  width: "min(1200px, 100%)",
  margin: "0 auto",
  padding: "24px 16px",
  display: "grid",
  gap: 20,
  justifyItems: "center", // ⟵ centers the card & any blocks
  boxSizing: "border-box",
};

export default function LeaderboardPage() {
  const { address } = useController();

  return (
    <>
      <R3FDither pixelSize={1.1} colorNum={10} waveAmplitude={0.15} waveSpeed={0.03} opacity={0.5} />
      <div style={WRAPPER}>
        <Navbar />
        <main style={MAIN}>
          <GhostProfileCard address={address} enableTilt className="leaderboard-card" />
          {/* Make sure your table fills the container width */}
          <div style={{ width: "100%" }}>
            <LeaderboardTable />
          </div>
        </main>
      </div>
    </>
  );
}
