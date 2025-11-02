import { useEffect, useMemo, useState, useRef, useLayoutEffect, useCallback } from "react";
import { exec } from "./lib/dojo";
import MiniHost, { type MiniKind, type MiniResult } from "./mini/MiniHost";
import NavBar from "./ui/Navbar";
import R3FDither from "./ui/R3FDither";
import { TORII_URL } from "./lib/torii";
import { useController } from "./hooks/useController";
import controller, { getLastWalletAccount, getLastWalletAddress } from "./chain/controller";

import mapPng from "./assets/map.png";
import playerPng from "./assets/player.png";
const SPRITES = { map: mapPng, player: playerPng } as const;

const THEME = {
  bg: "#0b0a09",
  text: "#e8e0c8",
  textMuted: "#b9aa86",
  accent: "#e6c17b",
  panel: "#12100d",
  panelEdge: "#241c13",
  btnBg: "#1a140e",
  btnEdge: "#2b2116",
  tileLine: "rgba(232,210,150,0.08)",
  tileLineActive: "rgba(232,210,150,0.24)",
};

type Run = {
  px: number; py: number; grid_w: number; grid_h: number;
  credits: number; step: number; evidence: number; active: boolean;
};

type EvidenceKey = "thermo" | "uv" | "emf" | "spirit" | "writing" | "prop";
type GhostDef = { id: number; name: string; evidence: EvidenceKey[]; };

const GHOSTS: GhostDef[] = [
  { id: 1, name: "Wraith",      evidence: ["uv", "emf", "spirit"] },
  { id: 2, name: "Phantom",     evidence: ["uv", "spirit", "writing"] },
  { id: 3, name: "Poltergeist", evidence: ["emf", "writing", "prop"] },
  { id: 4, name: "Banshee",     evidence: ["uv", "writing", "prop"] },
  { id: 5, name: "Shade",       evidence: ["thermo", "writing", "emf"] },
  { id: 6, name: "Revenant",    evidence: ["thermo", "uv", "spirit"] },
];

const EVBIT: Record<EvidenceKey, number> = { thermo:0, uv:1, emf:2, spirit:3, writing:4, prop:5 } as const;
const hasBit = (mask: number, bit: number) => ((mask >>> bit) & 1) === 1;
const evidenceFromMask = (mask: number) => ({
  thermo: hasBit(mask, EVBIT.thermo),
  uv:     hasBit(mask, EVBIT.uv),
  emf:    hasBit(mask, EVBIT.emf),
  spirit: hasBit(mask, EVBIT.spirit),
  writing:hasBit(mask, EVBIT.writing),
  prop:   hasBit(mask, EVBIT.prop),
});
const bitCount6 = (m: number) =>
  ((m & 1) + ((m>>1)&1) + ((m>>2)&1) + ((m>>3)&1) + ((m>>4)&1) + ((m>>5)&1));

function usePreloadImages(urls: string[]) {
  useEffect(() => { urls.forEach(u => { const i = new Image(); i.src = u; }); }, [urls]);
}
const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

async function waitForEvidenceUpdate(opts: {
  addr: string; bit: number; beforeMask: number; timeoutMs?: number; intervalMs?: number;
}) {
  const { addr, bit, beforeMask, timeoutMs = 5000, intervalMs = 250 } = opts;
  const deadline = Date.now() + timeoutMs;
  let latest: Run | null = null;
  while (Date.now() < deadline) {
    const r = await fetchRun(addr);
    if (r) {
      latest = r;
      if (r.evidence !== beforeMask || ((r.evidence >>> bit) & 1) === 1) break;
    }
    await sleep(intervalMs);
  }
  return latest;
}

async function waitForRunChange(opts: {
  addr: string;
  before: Run | null;
  timeoutMs?: number;
  intervalMs?: number;
}): Promise<Run | null> {
  const { addr, before, timeoutMs = 12000, intervalMs = 250 } = opts;
  const deadline = Date.now() + timeoutMs;
  let latest: Run | null = null;

  while (Date.now() < deadline) {
    const r = await fetchRun(addr);
    if (r) {
      latest = r;
      const changed =
        !before ||
        r.step !== before.step ||
        r.px !== before.px ||
        r.py !== before.py ||
        r.credits !== before.credits ||
        r.active !== before.active;
      if (changed) break;
    }
    await sleep(intervalMs);
  }
  return latest;
}

const EMPTY_FILTERS: Record<EvidenceKey, boolean> = {
  thermo: false, uv: false, emf: false, spirit: false, writing: false, prop: false,
};

const GHOST_KIND_BY_NAME: Record<string, number> = {
  Wraith: 0, Phantom: 1, Poltergeist: 2, Banshee: 3, Shade: 4, Revenant: 5,
} as const;

const KIND_TO_NAME: Record<number, string> = {
  0: "Wraith", 1: "Phantom", 2: "Poltergeist", 3: "Banshee", 4: "Shade", 5: "Revenant",
} as const;
const NAME_TO_KIND: Record<string, number> = {
  wraith: 0, phantom: 1, poltergeist: 2, banshee: 3, shade: 4, revenant: 5,
} as const;

function parseKind(k: unknown): number | null {
  if (k == null) return null;
  if (typeof k === "number") return k;
  if (typeof k === "string") {
    if (k.startsWith("0x")) { const n = Number(BigInt(k)); return Number.isNaN(n) ? null : n; }
    const lower = k.trim().toLowerCase();
    if (lower in NAME_TO_KIND) return NAME_TO_KIND[lower as keyof typeof NAME_TO_KIND];
    const n = Number(k); return Number.isNaN(n) ? null : n;
  }
  return null;
}
const titleize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s);

/* ---------------- Torii reads (use env URL) ---------------- */
async function fetchRun(addr: string): Promise<Run | null> {
  const q = `
    query ($keys: [String!]!, $first: Int = 1) {
      entities(keys: $keys, first: $first) {
        edges { node { models { __typename
          ... on ghostgrid_Run { px py grid_w grid_h credits step evidence active }
        } } }
      }
    }`;
  try {
    const r = await fetch(TORII_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: q, variables: { keys: [addr], first: 1 } }),
    });

    if (!r.ok) {
      console.error("[GG] Torii HTTP error", r.status, r.statusText);
      return null;
    }

    const j = await r.json();
    if (j?.errors?.length) {
      console.error("[GG] Torii GraphQL errors:", j.errors);
    }

    const models = j?.data?.entities?.edges?.[0]?.node?.models ?? [];
    const run = models.find((m: any) => m?.__typename === "ghostgrid_Run") ?? null;

    if (!run) {
      console.warn("[GG] fetchRun: no Run for addr", addr, "on", TORII_URL);
    }
    return run;
  } catch (e) {
    console.error("[GG] fetchRun failed:", e);
    return null;
  }
}

type GhostRow = { gx: number; gy: number; kind: number | string };
async function fetchGhost(addr: string): Promise<GhostRow | null> {
  const q = `
    query ($keys: [String!]!, $first: Int = 1) {
      entities(keys: $keys, first: $first) {
        edges { node { models { __typename
          ... on ghostgrid_Ghost { gx gy kind }
        } } }
      }
    }`;
  try {
    const r = await fetch(TORII_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: q, variables: { keys: [addr], first: 1 } }),
    });

    if (!r.ok) {
      console.error("[GG] Torii HTTP error", r.status, r.statusText);
      return null;
    }

    const j = await r.json();
    if (j?.errors?.length) {
      console.error("[GG] Torii GraphQL errors:", j.errors);
    }

    const models = j?.data?.entities?.edges?.[0]?.node?.models ?? [];
    const ghost = models.find((m: any) => m?.__typename === "ghostgrid_Ghost") ?? null;

    if (!ghost) {
      console.warn("[GG] fetchGhost: no Ghost for addr", addr, "on", TORII_URL);
    }
    return ghost;
  } catch (e) {
    console.error("[GG] fetchGhost failed:", e);
    return null;
  }
}

const DIR = { Left: 0, Right: 1, Up: 2, Down: 3 } as const;

const BTN: React.CSSProperties = {
  padding: "clamp(6px, 1.2vh, 10px) clamp(10px, 1.8vh, 14px)",
  borderRadius: 10,
  border: `1px solid ${THEME.btnEdge}`,
  background: THEME.btnBg,
  color: THEME.text,
  fontSize: "clamp(12px, 1.7vh, 14px)",
  fontWeight: 600,
  cursor: "pointer",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.02), 0 1px 12px rgba(0,0,0,.25)",
  transition: "filter .15s ease, transform .02s ease",
};
const BTN_DISABLED: React.CSSProperties = { ...BTN, opacity: 0.55, cursor: "not-allowed", filter: "saturate(.8)" };
const PANEL: React.CSSProperties = {
  background: THEME.panel,
  border: `1px solid ${THEME.panelEdge}`,
  borderRadius: 16,
  padding: 10,
  boxShadow: "0 12px 28px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.02)",
};

function useSquareInside(boxRef: React.RefObject<HTMLElement | null>, minPx = 160) {
  const [size, setSize] = useState(minPx);
  useLayoutEffect(() => {
    const calc = () => {
      const w = boxRef.current?.clientWidth ?? 0;
      const h = boxRef.current?.clientHeight ?? 0;
      if (!w || !h) return;
      setSize(Math.max(minPx, Math.min(w, h)));
    };
    calc();
    const ro = new ResizeObserver(calc);
    if (boxRef.current) ro.observe(boxRef.current);
    window.addEventListener("resize", calc);
    return () => { ro.disconnect(); window.removeEventListener("resize", calc); };
  }, [boxRef, minPx]);
  return size;
}

function useRefreshWithRetryAddr(addr: string) {
  return async (tries = 30, delayMs = 500) => {
    for (let i = 0; i < tries; i++) {
      const r = await fetchRun(addr);
      if (r) return r;
      await new Promise(res => setTimeout(res, delayMs));
    }
    return null;
  };
}

function inGhostRoom(px: number, py: number, gx: number, gy: number) {
  const xok = px === gx || px === gx + 1;
  const yok = py === gy || py === gy + 1;
  return xok && yok;
}

/** Resolve a usable address (wallet OR session account) for Torii reads. */
async function resolveAddress(): Promise<string | null> {
  const c: any = controller;
  let acc =
    (await c.getActiveAccount?.({ preferSession: true })) ||
    (await c.getSessionAccount?.()) ||
    (await c.session?.getAccount?.()) ||
    c.session?.account ||
    (await c.getActiveAccount?.());

  if (!acc) acc = getLastWalletAccount();

  const raw =
    acc?.address ??
    acc?.account?.address ??
    acc?.signer?.address ??
    (typeof acc?.getAddress === "function" ? await acc.getAddress() : null) ??
    (await getLastWalletAddress());

  const addr = typeof raw === "string" ? raw : raw != null ? String(raw) : null;
  console.warn("[GG] resolveAddress ->", addr);
  return addr;
}

export default function App() {
  const { address: playerAddr, connect, chainId, sessionActive, startSession } = useController();
  const onSepolia = chainId === "0x534e5f5345504f4c4941" || chainId === "SN_SEPOLIA";
  const chainLabel = onSepolia ? "Sepolia" : (chainId ?? "unknown");

  const [run, setRun] = useState<Run | null>(null);
  const [busy, setBusy] = useState(false);
  const [filters, setFilters] = useState<Record<EvidenceKey, boolean>>({ ...EMPTY_FILTERS });
  const [reportOpen, setReportOpen] = useState(false);
  const [alert, setAlert] = useState<null | { title: string; body: string; img?: string }>(null);
  const [selectedGhostId, setSelectedGhostId] = useState<number | null>(null);
  const [mini, setMini] = useState<MiniKind | null>(null);
  const [ghostPos, setGhostPos] = useState<{ gx: number; gy: number } | null>(null);

  const hbRef = useRef<HTMLAudioElement | null>(null);
  const stepRef = useRef<HTMLAudioElement | null>(null);
  const bgRef = useRef<HTMLAudioElement | null>(null);
  const [ambienceOn, setAmbienceOn] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem("ambienceOn") !== "false";
  });

  const closeMini = useCallback(() => setMini(null), []);
  usePreloadImages([SPRITES.map, SPRITES.player]);

  async function refresh() {
    const readAddr = playerAddr ?? (await resolveAddress());
    if (!readAddr) return;
    const r = await fetchRun(readAddr);
    setRun(r);
  }
  useEffect(() => { refresh(); }, [playerAddr, sessionActive]);

  useEffect(() => {
    if (typeof Audio === "undefined") return;
    hbRef.current = new Audio("/heartbeat.mp3"); hbRef.current.loop = true; hbRef.current.volume = 0;
    stepRef.current = new Audio("/step.mp3");    stepRef.current.volume = 0.7;
    return () => { try { hbRef.current?.pause(); } catch{}; hbRef.current = null; try { stepRef.current?.pause(); } catch{}; stepRef.current = null; };
  }, []);

  useEffect(() => {
    if (typeof Audio === "undefined") return;
    const bg = new Audio("/background.mp3"); bg.loop = true; bg.volume = 0.22; bgRef.current = bg;
    const tryPlay = () => { if (ambienceOn) bg.play().catch(() => {}); };
    tryPlay();
    const unlock = () => { tryPlay(); window.removeEventListener("pointerdown", unlock); };
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => { window.removeEventListener("pointerdown", unlock); try { bg.pause(); } catch{}; bgRef.current = null; };
  }, []); // eslint-disable-line

  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem("ambienceOn", ambienceOn ? "true" : "false");
    const bg = bgRef.current; if (!bg) return;
    if (ambienceOn) bg.play().catch(() => {}); else { try { bg.pause(); } catch {} }
  }, [ambienceOn]);

  useEffect(() => {
    let ignore = false;
    (async () => {
      if (!run?.active) { setGhostPos(null); return; }
      const readAddr = playerAddr ?? (await resolveAddress());
      if (!readAddr) { setGhostPos(null); return; }
      const g = await fetchGhost(readAddr);
      if (!ignore && g) setGhostPos({ gx: Number(g.gx), gy: Number(g.gy) });
    })();
    return () => { ignore = true; };
  }, [playerAddr, sessionActive, run?.active, run?.step]);

  const startStepLoop = useCallback(() => {
    const a = stepRef.current; if (!a) return;
    try { a.loop = true; a.currentTime = 0; a.play().catch(() => {}); } catch {}
  }, []);
  const stopStepLoop = useCallback(() => {
    const a = stepRef.current; if (!a) return;
    try { a.loop = false; a.pause(); a.currentTime = 0; } catch {}
  }, []);

  useEffect(() => {
    const hb = hbRef.current;
    const inside = !!(run?.active && ghostPos && inGhostRoom(run.px, run.py, ghostPos.gx, ghostPos.gy));
    if (!hb) return;
    if (inside) { try { hb.loop = true; hb.volume = 1; hb.playbackRate = 1; hb.play().catch(() => {}); } catch {} }
    else { try { hb.pause(); hb.currentTime = 0; hb.volume = 0; } catch {} }
  }, [run?.active, run?.px, run?.py, ghostPos?.gx, ghostPos?.gy]);

  async function doTx(fn: () => Promise<any>) {
    setBusy(true);
    try {
      await fn();
      // opportunistic refresh using any resolved address
      const readAddr = playerAddr ?? (await resolveAddress());
      if (readAddr) {
        const r = await useRefreshWithRetryAddr(readAddr)();
        if (r) setRun(r);
      }
    } catch (e) {
      console.error(e);
      alertModal("Transaction failed", (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const doMove = useCallback(async (dir: number) => {
    if (busy || !run?.active || (run?.credits ?? 0) <= 0) return;

    setBusy(true);
    const before = run;
    const startedAt = Date.now();
    const MIN_STEP_MS = 450;
    startStepLoop();

    try {
      await exec("move", [dir]);
      const readAddr = playerAddr ?? (await resolveAddress());
      if (readAddr) {
        const updated = await waitForRunChange({
          addr: readAddr,
          before,
          timeoutMs: 12000,
          intervalMs: 250,
        });
        if (updated) setRun(updated);
      }
    } catch (e) {
      console.error(e);
      alertModal("Move failed", (e as Error).message);
    } finally {
      const remaining = Math.max(0, MIN_STEP_MS - (Date.now() - startedAt));
      setTimeout(() => {
        stopStepLoop();
        setBusy(false);
      }, remaining);
    }
  }, [busy, run, playerAddr, startStepLoop, stopStepLoop]);

  const hasIdentity = !!(playerAddr || sessionActive);
  const ctaLabel =
    !hasIdentity ? "Sign in to play" :
    !sessionActive ? "Enable Session" :
    !onSepolia ? "Switch to Sepolia" :
    run?.active ? "Restart Run" : "Start New Run";

  function alertModal(title: string, body: string, img?: string) {
    setAlert({ title, body, img }); setTimeout(() => setAlert(null), 1500);
  }

  const DEFAULT_W = 7;
  const DEFAULT_H = 7;
  const W = run?.grid_w ?? DEFAULT_W;
  const H = run?.grid_h ?? DEFAULT_H;
  const px = run?.px ?? 0;
  const py = run?.py ?? 0;
  const canLeft  = run ? px > 0     : true;
  const canRight = run ? px < W - 1 : true;
  const canUp    = run ? py > 0     : true;
  const canDown  = run ? py < H - 1 : true;
  const isDead = run ? !run.active : false;
  const canUseToolsHere = !!(run?.active && ghostPos && inGhostRoom(px, py, ghostPos.gx, ghostPos.gy));

  const found = useMemo(() => evidenceFromMask(run?.evidence ?? 0), [run?.evidence]);
  const required = useMemo(
    () => (Object.keys(found) as EvidenceKey[]).filter((key) => (found as any)[key] || (filters as any)[key]),
    [found, filters]
  );
  const viableGhosts = useMemo(() => (!required.length ? GHOSTS : GHOSTS.filter(g => required.every(req => g.evidence.includes(req)))), [required]);
  const SUPPORTED = useMemo(() => GHOSTS.filter(sg => viableGhosts.some(v => v.id === sg.id)), [viableGhosts]);

  async function useTool(
    bitKey: EvidenceKey,
    entrypoint: "use_thermo" | "use_uv" | "use_emf" | "use_spirit" | "use_writing" | "use_prop",
    texts: { found: string; none: string }
  ) {
    const readAddr = playerAddr ?? (await resolveAddress());
    if (!readAddr) return;
    const before = run?.evidence ?? 0;
    await doTx(() => exec(entrypoint, []));
    const updated = await waitForEvidenceUpdate({ addr: readAddr, bit: EVBIT[bitKey], beforeMask: before, timeoutMs: 5000, intervalMs: 250 });
    const finalMask = updated?.evidence ?? before;
    if (updated) setRun(updated);
    const got = hasBit(finalMask, EVBIT[bitKey]);
    alertModal(got ? "Evidence found" : "No response", got ? texts.found : texts.none);
  }

  const ensureRoomOrToast = useCallback(() => {
    if (!canUseToolsHere) { alertModal("Not here", "You haven’t found the ghost room yet."); return false; }
    return true;
  }, [canUseToolsHere]);

  const openMini = useCallback((kind: MiniKind) => { if (!ensureRoomOrToast()) return; setMini(kind); }, [ensureRoomOrToast]);

  const onThermo  = async () => { if (!ensureRoomOrToast()) return; await useTool("thermo",  "use_thermo",  {found:"You sense a chill…",                 none:"No unusual temperature."}); };
  const onUV      = async () => { if (!ensureRoomOrToast()) return; await useTool("uv",      "use_uv",      {found:"A ghostly handprint shimmers.",      none:"No prints here."}); };
  const onEMF     = async () => { if (!ensureRoomOrToast()) return; await useTool("emf",     "use_emf",     {found:"The reader spikes violently!",       none:"EMF is silent."}); };
  const onSpirit  = async () => { if (!ensureRoomOrToast()) return; await useTool("spirit",  "use_spirit",  {found:"A whisper answers from beyond.",     none:"Silence answers back."}); };
  const onWriting = async () => { if (!ensureRoomOrToast()) return; await useTool("writing", "use_writing", {found:"Fresh letters carve into the page.", none:"No writing appears."}); };
  const onProp    = async () => { if (!ensureRoomOrToast()) return; await useTool("prop",    "use_prop",    {found:"Objects rattle and fly.",            none:"Nothing moves."}); };

  const onMiniDone = async (res: MiniResult) => {
    const played = mini; closeMini();
    if (!res.success) { alertModal("No response", "You fumbled the tool."); return; }
    if (played === "thermo")      await onThermo();
    else if (played === "uv")     await onUV();
    else if (played === "emf")    await onEMF();
    else if (played === "spirit") await onSpirit();
    else if (played === "writing")await onWriting();
    else if (played === "prop")   await onProp();
  };

  const onGuess = async () => {
    if (!selectedGhostId) { alertModal("Pick a ghost", "Select a ghost in the report first."); return; }
    const g = GHOSTS.find(x => x.id === selectedGhostId);
    if (!g) { alertModal("Invalid selection", "Could not find the selected ghost."); return; }
    const enumId = GHOST_KIND_BY_NAME[g.name]; if (enumId === undefined) { alertModal("Unsupported ghost", `${g.name} isn’t enabled on-chain yet.`); return; }
    const readAddr = playerAddr ?? (await resolveAddress());
    if (!readAddr) return;
    await doTx(() => exec("guess", [enumId]));
    const ghost = await fetchGhost(readAddr);
    const parsedActual = parseKind(ghost?.kind);
    const correct = parsedActual !== null && parsedActual === enumId;
    const actualName = parsedActual !== null ? (KIND_TO_NAME[parsedActual] ?? `#${parsedActual}`) :
      (typeof ghost?.kind === "string" ? titleize(ghost!.kind) : "unknown");
    alertModal(correct ? "Correct!" : "Wrong", correct ? `It was ${g.name}. Nice!` : `It was actually ${actualName}.`);
    setReportOpen(false); setSelectedGhostId(null);
  };

  const wrapperRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const gridBoxRef = useRef<HTMLDivElement>(null);
  const gridPx = useSquareInside(gridBoxRef, 160);
  const cellPx = gridPx / Math.max(1, W);
  const cellPy = gridPx / Math.max(1, H);

  return (
    <>
      <R3FDither pixelSize={1.1} colorNum={10} waveAmplitude={0.15} waveSpeed={0.03} opacity={0.5} />
      <div
        ref={wrapperRef}
        style={{
          fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto",
          color: THEME.text,
          background: "transparent",
          minHeight: "100dvh",
          width: "100vw",
          overflow: "hidden",
          display: "grid",
          gridTemplateRows: "auto 1fr",
          position: "relative",
          zIndex: 1,
        }}
      >
        <NavBar />

        {/* block clicks during tx */}
        {busy && <div style={{ position: "fixed", inset: 0, zIndex: 90, cursor: "progress", background: "rgba(0,0,0,0)" }} />}

        <div
          ref={pageRef}
          style={{
            height: "100%",
            width: "min(1100px, 100%)",
            margin: "0 auto",
            padding: 16,
            boxSizing: "border-box",
            display: "grid",
            gridTemplateRows: "auto 1fr auto",
            gap: 12,
            minHeight: 0,
          }}
        >
          {/* Stats + Start */}
          <div style={{ ...PANEL, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 14, fontWeight: 700, color: THEME.textMuted }}>
              <span>credits: {run?.credits ?? "-"}</span>
              <span>step: {run?.step ?? "-"}</span>
              <span>evidence: {bitCount6(run?.evidence ?? 0)}/3</span>
              {!run?.active && <span style={{ opacity: 0.7 }}>(finished)</span>}
            </div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  style={busy ? BTN_DISABLED : BTN}
                  disabled={busy}
                  onClick={async () => {
                    if (busy) return;

                    try { await connect(); } catch {}
                    try { await startSession(); } catch {}

                    if (!onSepolia) return;

                    setBusy(true);
                    const before = run ?? null;
                    try {
                      await exec("start_run", []);
                      const readAddr = playerAddr ?? (await resolveAddress());
                      let updated: Run | null = null;

                      if (!readAddr) {
                        console.debug("[start_run] no address available to poll yet");
                      } else {
                        updated = await waitForRunChange({
                          addr: readAddr,
                          before,
                          timeoutMs: 15000,
                          intervalMs: 350,
                        });
                      }

                      setSelectedGhostId(null);
                      setFilters({ ...EMPTY_FILTERS });
                      if (updated) setRun(updated);

                      if (readAddr) {
                        const g = await fetchGhost(readAddr);
                        setGhostPos(g ? { gx: Number(g.gx), gy: Number(g.gy) } : null);
                      } else {
                        setGhostPos(null);
                      }

                      try { await bgRef.current?.play(); } catch {}
                      try { await hbRef.current?.play(); } catch {}
                      try {
                        hbRef.current?.pause();
                        if (hbRef.current) {
                          hbRef.current.currentTime = 0;
                          hbRef.current.volume = 0;
                        }
                      } catch {}
                    } catch (e) {
                      console.error(e);
                      alertModal("Start failed", (e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {ctaLabel}
                </button>
                <button
                  style={BTN}
                  onClick={() => setAmbienceOn((v) => !v)}
                  aria-pressed={ambienceOn}
                  title={ambienceOn ? "Turn ambience off" : "Turn ambience on"}
                >
                  {ambienceOn ? "Ambience: On" : "Ambience: Off"}
                </button>
              </div>
              {(!onSepolia) && (
                <div style={{ marginTop: 8, fontSize: 12, opacity: 0.85, textAlign: "right" }}>
                  You’re connected to <b>{chainLabel}</b>. Switch Controller to <b>Sepolia</b> (0x534e5f5345504f4c4941).
                </div>
              )}
            </div>
          </div>

          {/* Stage */}
          <div style={{ ...PANEL, position: "relative", minHeight: 0, overflow: "hidden", display: "grid", placeItems: "center" }}>
            <div ref={gridBoxRef} style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", minHeight: 0, position: "relative" }}>
              <div style={{ width: gridPx, height: gridPx, maxWidth: "100%", maxHeight: "100%", position: "relative" }}>
                <img src={SPRITES.map} alt="map" style={{
                  position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "fill",
                  imageRendering: "pixelated" as any, zIndex: 1, pointerEvents: "none", userSelect: "none",
                }} />
                <img src={SPRITES.player} alt="player" style={{
                  position: "absolute", left: (run?.px ?? 0) * cellPx, top: (run?.py ?? 0) * cellPy,
                  width: cellPx, height: cellPy, imageRendering: "pixelated" as any,
                  zIndex: 3, pointerEvents: "none", userSelect: "none",
                }} />
                <div style={{
                  position: "absolute", inset: 0, display: "grid",
                  gridTemplateColumns: `repeat(${W}, 1fr)`, gridTemplateRows: `repeat(${H}, 1fr)`, gap: 6, zIndex: 4,
                  pointerEvents: "none", background: "transparent",
                }}>
                  {Array.from({ length: W * H }, (_, i) => {
                    const x = i % W, y = Math.floor(i / W);
                    const isPlayer = run && x === (run.px ?? 0) && y === (run.py ?? 0);
                    return (
                      <div key={i} style={{
                        borderRadius: 8, boxShadow: `inset 0 0 0 1px ${THEME.tileLine}`, background: "transparent",
                        ...(isPlayer ? { boxShadow: `0 0 6px rgba(232,210,150,0.14), inset 0 0 0 2px ${THEME.tileLineActive}` } : {}),
                      }} />
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
              <button style={(!canLeft || busy || isDead) ? BTN_DISABLED : BTN} disabled={!canLeft || busy || isDead} onClick={() => doMove(DIR.Left)}>Left</button>
              <button style={(!canUp || busy || isDead) ? BTN_DISABLED : BTN} disabled={!canUp || busy || isDead} onClick={() => doMove(DIR.Up)}>Up</button>
              <button style={(!canDown || busy || isDead) ? BTN_DISABLED : BTN} disabled={!canDown || busy || isDead} onClick={() => doMove(DIR.Down)}>Down</button>
              <button style={(!canRight || busy || isDead) ? BTN_DISABLED : BTN} disabled={!canRight || busy || isDead} onClick={() => doMove(DIR.Right)}>Right</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6 }}>
              <button style={(busy || isDead) ? BTN_DISABLED : BTN} disabled={busy || isDead} onClick={() => openMini("thermo")}>Thermometer</button>
              <button style={(busy || isDead) ? BTN_DISABLED : BTN} disabled={busy || isDead} onClick={() => openMini("uv")}>UV Light</button>
              <button style={(busy || isDead) ? BTN_DISABLED : BTN} disabled={busy || isDead} onClick={() => openMini("emf")}>EMF Reader</button>
              <button style={(busy || isDead) ? BTN_DISABLED : BTN} disabled={busy || isDead} onClick={() => openMini("spirit")}>Spirit Box</button>
              <button style={(busy || isDead) ? BTN_DISABLED : BTN} disabled={busy || isDead} onClick={() => openMini("writing")}>Writing Book</button>
              <button style={(busy || isDead) ? BTN_DISABLED : BTN} disabled={busy || isDead} onClick={() => openMini("prop")}>Prop</button>
            </div>

            <button style={busy ? BTN_DISABLED : BTN} disabled={busy} onClick={() => setReportOpen(true)}>Open Evidence Report</button>
          </div>
        </div>

        {alert && (
          <div onClick={() => setAlert(null)} style={{ position: "fixed", inset: 0, display: "grid", placeItems: "center", background: "rgba(0,0,0,.35)", zIndex: 20 }}>
            <div style={{ ...PANEL, width: "min(420px, 92vw)", textAlign: "center", maxHeight: "90dvh", overflow: "auto" }}>
              <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>{alert.title}</div>
              {alert.img && <img src={alert.img} alt="" style={{ width: "100%", borderRadius: 12, marginBottom: 8 }} />}
              <div style={{ opacity: .9 }}>{alert.body}</div>
            </div>
          </div>
        )}

        {reportOpen && (
          <div onClick={() => setReportOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "grid", placeItems: "center", zIndex: 30 }}>
            <div onClick={e => e.stopPropagation()} style={{ ...PANEL, width: "min(560px, 94vw)", display: "grid", gap: 12, maxHeight: "90dvh", overflow: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 800 }}>Evidence Report</div>
                <button style={BTN} onClick={() => setReportOpen(false)}>Close</button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                {([
                  ["thermo", "Freezing Temperature"],
                  ["uv", "UV Prints"],
                  ["emf", "EMF 5"],
                  ["spirit", "Spirit Box"],
                  ["writing", "Ghost Writing"],
                  ["prop", "Poltergeist Activity"],
                ] as const).map(([key, label]) => {
                  const k = key as EvidenceKey;
                  const isFound = (found as any)[k];
                  const checked = isFound ? true : !!(filters as any)[k];
                  return (
                    <label key={key} style={{ ...BTN, display: "flex", gap: 10, alignItems: "center" } as any}>
                      <input type="checkbox" checked={checked} disabled={isFound}
                        onChange={(e) => setFilters(f => ({ ...f, [k]: e.target.checked }))} />
                      {label}
                      {isFound && <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.7 }}>(found)</span>}
                    </label>
                  );
                })}
              </div>

              <div style={{ ...PANEL, background: "#101010" }}>
                <div style={{ fontWeight: 800, marginBottom: 8 }}>Possible Ghosts</div>
                <div style={{ display: "grid", gap: 6 }}>
                  {SUPPORTED.map(g => (
                    <label key={g.id} style={{
                      padding: 10, borderRadius: 10, border: "1px solid #2a2a2a",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      background: selectedGhostId === g.id ? "#1d1d1d" : "transparent",
                    }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{g.name}</div>
                        <div style={{ fontSize: 12, opacity: .8 }}>Evidence: {g.evidence.join(", ")}</div>
                      </div>
                      <input type="radio" name="ghost" checked={selectedGhostId === g.id} onChange={() => setSelectedGhostId(g.id)} />
                    </label>
                  ))}
                  {!SUPPORTED.length && <div style={{ opacity: .7 }}>No ghosts match this evidence yet.</div>}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button style={BTN} onClick={() => setFilters({ ...EMPTY_FILTERS })}>Clear Filters</button>
                <button style={selectedGhostId ? BTN : BTN_DISABLED} disabled={!selectedGhostId || busy} onClick={onGuess}>Submit Final Guess</button>
              </div>
            </div>
          </div>
        )}

        <MiniHost open={!!mini} kind={mini} onDone={onMiniDone} onCancel={closeMini} />
      </div>
    </>
  );
}
