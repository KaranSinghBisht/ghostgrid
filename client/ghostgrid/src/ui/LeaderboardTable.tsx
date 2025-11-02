// src/ui/LeaderboardTable.tsx
import React, { useEffect, useState } from "react";
import { fetchTopPlayers } from "../lib/torii";
import type { TopPlayer } from "../lib/torii";

const SHOWCASE_MODE = true;         // flip to false when going live
const TARGET_ROWS = 10;             // how many rows to show at minimum

const THEME = {
  text: "#e8e0c8",
  textMuted: "#b9aa86",
  accent: "#e6c17b",
  panel: "#12100d",
  edge: "#241c13",
};

const PANEL: React.CSSProperties = {
  background: THEME.panel,
  border: `1px solid ${THEME.edge}`,
  borderRadius: 16,
  boxShadow: "0 24px 60px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.02)",
};

function short(a?: string | null) {
  return a ? a.slice(0, 6) + "…" + a.slice(-4) : "";
}

// helper to coerce numbers safely (handles strings/bigints/null)
const num = (v: any, d = 0) => {
  if (v === null || v === undefined) return d;
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

// ✨ curated filler rows for showcase
const FILLER: TopPlayer[] = [
  { 
    address: "0x7b3f0a9c1d2e4f567890ab12cd34ef56ab90cdef", 
    totalRuns: 42, 
    totalWins: 18, 
    bestScore: 910, 
    avgSteps: 7.8,  
    avgBlocks: 12.3, 
    totalSteps: Math.round(42 * 7.8), 
    totalBlocks: Math.round(42 * 12.3), 
    winRate: 10 / 10 
  },
  { 
    address: "0xa1c2b3d4e5f60718293a4b5c6d7e8f9012ab34cd", 
    totalRuns: 37, 
    totalWins: 15, 
    bestScore: 860, 
    avgSteps: 8.4,  
    avgBlocks: 13.1, 
    totalSteps: Math.round(37 * 8.4), 
    totalBlocks: Math.round(37 * 13.1), 
    winRate: 9/10 
  },
  { 
    address: "0x9f0e1d2c3b4a59687766554433221100aa55bb66", 
    totalRuns: 29, 
    totalWins: 12, 
    bestScore: 805, 
    avgSteps: 9.1,  
    avgBlocks: 14.0, 
    totalSteps: Math.round(29 * 9.1), 
    totalBlocks: Math.round(29 * 14.0), 
    winRate: 8/10
  },
  { 
    address: "0x1234567890abcdef1234567890abcdef12345678", 
    totalRuns: 24, 
    totalWins: 10, 
    bestScore: 780, 
    avgSteps: 8.9,  
    avgBlocks: 13.7, 
    totalSteps: Math.round(24 * 8.9), 
    totalBlocks: Math.round(24 * 13.7), 
    winRate: 7/10
  },
  { 
    address: "0xbeefcafe0000aa11bb22cc33dd44ee55ff667788", 
    totalRuns: 33, 
    totalWins: 11, 
    bestScore: 795, 
    avgSteps: 10.2, 
    avgBlocks: 15.2, 
    totalSteps: Math.round(33 * 10.2), 
    totalBlocks: Math.round(33 * 15.2), 
    winRate: 11 / 33
  },
  { 
    address: "0xdeaddeaddeaddeaddeaddeaddeaddeaddeadbeef", 
    totalRuns: 18, 
    totalWins: 8, 
    bestScore: 720, 
    avgSteps: 9.6,  
    avgBlocks: 12.9, 
    totalSteps: Math.round(18 * 9.6), 
    totalBlocks: Math.round(18 * 12.9), 
    winRate: 8 / 180
  },
  { 
    address: "0x0badc0de91ab23cd45ef67ab89012cd34ef56aa1", 
    totalRuns: 21, 
    totalWins: 7, 
    bestScore: 705, 
    avgSteps: 10.8,  
    avgBlocks: 16.1, 
    totalSteps: Math.round(21 * 10.8), 
    totalBlocks: Math.round(21 * 16.1), 
    winRate: 7 / 210
  },
  { 
    address: "0x88aa77bb66cc55dd44ee33ff2211009988776655", 
    totalRuns: 27, 
    totalWins: 9, 
    bestScore: 740, 
    avgSteps: 9.3,  
    avgBlocks: 14.8, 
    totalSteps: Math.round(27 * 9.3), 
    totalBlocks: Math.round(27 * 14.8), 
    winRate: 9 / 270
  },
  { 
    address: "0xabc0abc0abc0abc0abc0abc0abc0abc0abc0abc0", 
    totalRuns: 16, 
    totalWins: 6, 
    bestScore: 690, 
    avgSteps: 8.6,  
    avgBlocks: 12.0, 
    totalSteps: Math.round(16 * 8.6), 
    totalBlocks: Math.round(16 * 12.0), 
    winRate: 6 / 1600
  },
  { 
    address: "0xfeedfeedfeedfeedfeedfeedfeedfeedfeedfeed", 
    totalRuns: 14, 
    totalWins: 5, 
    bestScore: 660, 
    avgSteps: 11.0,  
    avgBlocks: 16.8, 
    totalSteps: Math.round(14 * 11.0), 
    totalBlocks: Math.round(14 * 16.8), 
    winRate: 5 / 140000
  },
];

// merge real + filler (dedupe by address, keep real first)
function withFiller(real: TopPlayer[], need = TARGET_ROWS): TopPlayer[] {
  if (!SHOWCASE_MODE) return real;
  const seen = new Set(real.map(r => r.address));
  const padded = [...real];
  for (const f of FILLER) {
    if (padded.length >= need) break;
    if (!seen.has(f.address)) padded.push(f);
  }
  // still short? loop filler again (unlikely)
  let i = 0;
  while (padded.length < need) {
    padded.push({ ...FILLER[i % FILLER.length], address: `${FILLER[i % FILLER.length].address.slice(0, 40)}${(i/10|0)}${(i%10)}` });
    i++;
  }
  return padded;
}

export default function LeaderboardTable() {
  const [rows, setRows] = useState<TopPlayer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const list = await fetchTopPlayers(100);
        if (cancelled) return;
        const real = Array.isArray(list) ? list : [];
        setRows(withFiller(real, TARGET_ROWS));
      } catch {
        if (cancelled) return;
        // on error, just show filler
        setRows(withFiller([], TARGET_ROWS));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{ ...PANEL, padding: 16, minWidth: 0 }}>
      <div style={{ fontWeight: 900, color: THEME.accent, marginBottom: 10 }}>Top Players</div>

      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "separate",
            borderSpacing: 0,
            color: THEME.text,
            fontSize: 14,
          }}
        >
          <thead>
            <tr>
              {["#", "Address", "Ghosts Found", "Total Runs", "Best Score", "Win Rate", "Avg Steps", "Avg Blocks"].map((h, i) => (
                <th
                  key={i}
                  style={{
                    textAlign: i === 1 ? "left" : "right",
                    padding: "10px 12px",
                    borderBottom: `1px solid ${THEME.edge}`,
                    position: "sticky",
                    top: 0,
                    background: "rgba(18,16,13,.9)",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} style={{ padding: 14, textAlign: "center", opacity: 0.8 }}>
                  Loading…
                </td>
              </tr>
            )}

            {!loading && rows.map((p, idx) => {
              const totalRuns = num(p.totalRuns);
              const ghostsFound = num(p.totalWins);
              const bestScore = num(p.bestScore);
              const avgSteps = num(p.avgSteps);
              const avgBlocks = num(p.avgBlocks);
              const winRate = totalRuns ? (ghostsFound / totalRuns) * 100 : 0;

              return (
                <tr key={`${p.address}-${idx}`}>
                  <td style={cellR()}>{idx + 1}</td>
                  <td style={{ ...cellL(), fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                    {short(p.address)}
                  </td>
                  <td style={cellR()}>{ghostsFound}</td>
                  <td style={cellR()}>{totalRuns}</td>
                  <td style={cellR()}>{bestScore}</td>
                  <td style={cellR()}>{winRate.toFixed(1)}%</td>
                  <td style={cellR()}>{avgSteps.toFixed(1)}</td>
                  <td style={cellR()}>{avgBlocks.toFixed(1)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function cellR(): React.CSSProperties {
  return { padding: "10px 12px", textAlign: "right", borderBottom: `1px solid ${THEME.edge}` };
}
function cellL(): React.CSSProperties {
  return { padding: "10px 12px", textAlign: "left", borderBottom: `1px solid ${THEME.edge}` };
}