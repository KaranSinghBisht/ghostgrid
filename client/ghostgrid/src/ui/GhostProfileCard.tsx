// src/ui/GhostProfileCard.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./GhostProfileCard.css";
import { fetchPlayer, type PlayerRow } from "../lib/torii";

type Props = {
  address: string | null | undefined;
  handle?: string;
  avatarUrl?: string;
  enableTilt?: boolean;
  className?: string;
};

// 🔧 showcase toggle (true = pad with pretty demo numbers)
const SHOWCASE_MODE = true;

// curated fallback stats for the profile card
const DEMO_PLAYER: PlayerRow = {
  // only the fields we read are required; cast keeps TS happy
  total_runs: 34,
  correct_guesses: 14,
  sum_steps: 289,     // used to compute avg
  sum_blocks: 462,    // used to compute avg
  best_score: 905,
} as PlayerRow;

function short(addr?: string | null) {
  return addr ? addr.slice(0, 6) + "…" + addr.slice(-4) : "";
}

const clamp = (v: number, min = 0, max = 100) => Math.min(Math.max(v, min), max);
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const map = (v: number, a: number, b: number, c: number, d: number) => c + ((d - c) * (v - a)) / (b - a);

export default function GhostProfileCard({ address, handle, avatarUrl, enableTilt = true, className = "" }: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [row, setRow] = useState<PlayerRow | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // if there is no connected address, but we’re in showcase,
    // still show the demo stats.
    if (!address) {
      setRow(SHOWCASE_MODE ? DEMO_PLAYER : null);
      return;
    }

    (async () => {
      try {
        setLoading(true);
        const p = await fetchPlayer(address);
        if (!cancelled) {
          // if fetch returns null/undefined, fall back in showcase
          setRow(p ?? (SHOWCASE_MODE ? DEMO_PLAYER : null));
        }
      } catch {
        if (!cancelled) setRow(SHOWCASE_MODE ? DEMO_PLAYER : null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [address]);

  const stats = useMemo(() => {
    const tr = Number(row?.total_runs ?? 0);
    const wins = Number(row?.correct_guesses ?? 0);
    const steps = Number(row?.sum_steps ?? 0);
    const blocks = Number(row?.sum_blocks ?? 0);
    return {
      ghostsFound: wins,
      totalRuns: tr,
      bestScore: Number(row?.best_score ?? 0),
      winRate: tr ? wins / tr : 0,
      avgSteps: tr ? steps / tr : 0,
      avgBlocks: tr ? blocks / tr : 0,
    };
  }, [row]);

  useEffect(() => {
    if (!enableTilt) return;
    const card = cardRef.current;
    if (!card) return;

    let raf = 0;
    const onMove = (e: PointerEvent) => {
      const r = card.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      const px = clamp((100 / r.width) * x);
      const py = clamp((100 / r.height) * y);
      const cx = px - 50;
      const cy = py - 50;

      const rotX = -(cx / 6);
      const rotY = cy / 5;

      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        card.style.setProperty("--pointer-x", `${px}%`);
        card.style.setProperty("--pointer-y", `${py}%`);
        card.style.setProperty("--rotate-x", `${rotY.toFixed(2)}deg`);
        card.style.setProperty("--rotate-y", `${rotX.toFixed(2)}deg`);
      });
    };

    const onLeave = () => {
      const start = performance.now();
      const startX = Number((card.style.getPropertyValue("--pointer-x") || "50%").replace("%", "")) || 50;
      const startY = Number((card.style.getPropertyValue("--pointer-y") || "50%").replace("%", "")) || 50;

      const loop = (t: number) => {
        const p = clamp((t - start) / 550, 0, 1);
        const e = easeInOut(p);
        const curX = map(e, 0, 1, startX, 50);
        const curY = map(e, 0, 1, startY, 50);
        card.style.setProperty("--pointer-x", `${curX}%`);
        card.style.setProperty("--pointer-y", `${curY}%`);
        card.style.setProperty("--rotate-x", `0deg`);
        card.style.setProperty("--rotate-y", `0deg`);
        if (p < 1) requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    };

    card.addEventListener("pointermove", onMove);
    card.addEventListener("pointerleave", onLeave);
    return () => {
      card.removeEventListener("pointermove", onMove);
      card.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, [enableTilt]);

  const copyAddress = useCallback(async () => {
    if (!address) return;
    try { await navigator.clipboard.writeText(address); } catch {}
  }, [address]);

  const badgeText =
    loading ? "Loading…" :
    address ? "Online" :
    SHOWCASE_MODE ? "Online" : "Offline";

  return (
    <div ref={wrapRef} className={`gpc-wrap ${className}`.trim()}>
      <section ref={cardRef} className="gpc-card" aria-live="polite">
        <div className="gpc-bg" />
        <div className="gpc-inner" />
        <div className="gpc-content">
          <div className="gpc-row">
            <div className="gpc-id">
              <div className="gpc-avatar">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" />
                ) : (
                  <div className="gpc-avatar-fallback">🎃</div>
                )}
              </div>
              <div className="gpc-names">
                <div className="gpc-handle">{handle ? `@${handle}` : short(address) || "@demo_player"}</div>
                <div className="gpc-address" title={address || ""} onClick={copyAddress}>
                  {short(address) || "0xDEMO…PLAY"} <span className="gpc-copy">copy</span>
                </div>
              </div>
            </div>
            <div className="gpc-badge">{badgeText}</div>
          </div>

          <div className="gpc-hero">
            <div className="gpc-hero-num">{stats.ghostsFound}</div>
            <div className="gpc-hero-label">ghosts found</div>
          </div>

          <div className="gpc-stats">
            <Stat label="Total runs" value={stats.totalRuns} />
            <Stat label="Best score" value={stats.bestScore} />
            <Stat label="Win rate" value={`${(stats.winRate * 100).toFixed(1)}%`} />
            <Stat label="Avg steps" value={stats.avgSteps.toFixed(1)} />
            <Stat label="Avg blocks" value={stats.avgBlocks.toFixed(1)} />
          </div>

          <div className="gpc-actions">
            <a className="gpc-btn" href="/leaderboard">Leaderboard</a>
            <button className="gpc-btn ghost" onClick={copyAddress}>Copy Address</button>
          </div>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="gpc-stat">
      <div className="gpc-stat-value">{value}</div>
      <div className="gpc-stat-label">{label}</div>
    </div>
  );
}