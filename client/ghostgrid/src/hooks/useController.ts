import { useCallback, useEffect, useState } from "react";
import controller, {
  startSession as connectorStartSession,
  readAccount as connectorReadAccount,
  isSessionActive as connectorIsSessionActive,
  CHAIN_ID_HEX,
  CHAIN_NAME,
  cacheWalletAccount,
} from "../chain/controller";

const ENV: Record<string, any> =
  typeof import.meta !== "undefined" ? ((import.meta as any).env || {}) : {};

const WORLD   = ENV.VITE_WORLD_ADDRESS as string | undefined;
const ACTIONS = ENV.VITE_ACTIONS_ADDRESS as string | undefined;
const SPIRIT  = ENV.VITE_SPIRIT_ADDRESS  as string | undefined;

function buildPolicyRules() {
  const rules: any[] = [];
  if (SPIRIT) rules.push({ kind: "contract-allow", address: SPIRIT, entrypoints: ["start_run","move","use_thermo","use_uv","use_emf","use_spirit","use_writing","use_prop","guess"] });
  if (ACTIONS) rules.push({ kind: "contract-allow", address: ACTIONS, entrypoints: ["spawn"] });
  if (WORLD)   rules.push({ kind: "contract-allow", address: WORLD,   entrypoints: ["execute"] });

  // hardening defaults
  rules.push(
    { kind: "max-fee", wei: (ENV.VITE_SESSION_MAX_FEE_WEI as string) || "5000000000000000" },
    { kind: "rate-limit", maxCalls: Number(ENV.VITE_SESSION_MAX_CALLS ?? 100), perSeconds: 60 },
    { kind: "expires-in", seconds: Number(ENV.VITE_SESSION_TTL ?? 1800) },
    { kind: "chain", id: CHAIN_ID_HEX },
  );
  return rules;
}

export function useController() {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [sessionActive, setSessionActive] = useState<boolean>(false);

  const refreshAll = useCallback(async () => {
    const acct = await connectorReadAccount();
    console.log("[GG] readAccount ->", acct);
    setAddress(acct.address);
    setChainId(acct.chainId ?? CHAIN_NAME);

    if (!acct.active) {
      console.log("[GG] session not active; stop polling");
      setSessionActive(false);
      return false;
    }

    const active = await connectorIsSessionActive();
    console.log("[GG] readSessionActive ->", active);
    setSessionActive(active);
    return active;
  }, []);

  useEffect(() => { void refreshAll(); }, [refreshAll]);

  useEffect(() => {
    if (!sessionActive) return;
    const timer = setInterval(() => { refreshAll().catch(() => {}); }, 5000);
    return () => clearInterval(timer);
  }, [sessionActive, refreshAll]);

  const connect = useCallback(async () => {
    const acc = await (controller as any).connect?.();
    cacheWalletAccount(acc);
    await refreshAll();
    return acc;
  }, [refreshAll]);

  const startSession = useCallback(async () => {
    const rules = buildPolicyRules();
    try {
      await connectorStartSession(rules);
    } catch (err) {
      console.error("[GG] connect failed", err);
    }
    await refreshAll();
  }, [refreshAll]);

  return { address, chainId, sessionActive, connect, startSession };
}

export default useController;
