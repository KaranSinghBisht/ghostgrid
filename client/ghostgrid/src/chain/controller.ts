import Controller from "@cartridge/controller";
import { constants } from "starknet";
import { d, warn, expose } from "../lib/debug";

// ---------- Env ----------
const ENV: Record<string, any> =
  typeof import.meta !== "undefined" ? ((import.meta as any).env || {}) : {};

type Hex = `0x${string}`;
const toHexLower = (v?: string): Hex | undefined => (v ? (v.toLowerCase() as Hex) : undefined);

const WORLD   = toHexLower(ENV.VITE_WORLD_ADDRESS);
const ACTIONS = toHexLower(ENV.VITE_ACTIONS_ADDRESS);
const SPIRIT  = toHexLower(ENV.VITE_SPIRIT_ADDRESS);

d("controller env addrs", { WORLD, ACTIONS, SPIRIT });

export const CHAIN_ID_HEX: string =
  (constants as any)?.StarknetChainId?.SN_SEPOLIA ?? "0x534e5f5345504f4c4941";

export const CHAIN_NAME = "SN_SEPOLIA";

let LAST_WALLET_ACC: any | null = null;
export const getLastWalletAccount = () => LAST_WALLET_ACC;
export const getLastWalletAddress = async (): Promise<string | null> => {
  const acc: any = LAST_WALLET_ACC;
  if (!acc) return null;
  const raw =
    acc.address ??
    acc.account?.address ??
    acc.signer?.address ??
    (typeof acc.getAddress === "function" ? await acc.getAddress() : null);
  return typeof raw === "string" ? raw : raw != null ? String(raw) : null;
};
export const cacheWalletAccount = (acc: any) => {
  if (acc) LAST_WALLET_ACC = acc;
};
// ---------- Default contracts map (for display / optional) ----------
export const POLICIES = {
  contracts: {
    ...(SPIRIT && {
      [SPIRIT]: {
        name: "GhostGrid Core",
        description: "Session for gameplay calls",
        methods: [
          { name: "Start run", entrypoint: "start_run" },
          { entrypoint: "move" },
          { entrypoint: "use_thermo" },
          { entrypoint: "use_uv" },
          { entrypoint: "use_emf" },
          { entrypoint: "use_spirit" },
          { entrypoint: "use_writing" },
          { entrypoint: "use_prop" },
          { entrypoint: "guess" },
        ],
      },
    }),
    ...(ACTIONS && { [ACTIONS]: { name: "Actions", methods: [{ entrypoint: "spawn" }] } }),
    ...(WORLD   && { [WORLD]:   { name: "World",   methods: [{ entrypoint: "execute" }] } }),
  },
} as const;

// ---------- Controller ----------
const controller = new Controller({
  // Older @cartridge/controller types may reject "id" at compile time.
  // We still pass it (casted) because at runtime the session engine needs it.
  chains: [{ id: CHAIN_ID_HEX, rpcUrl: "https://api.cartridge.gg/x/starknet/sepolia" } as any],
  defaultChainId: CHAIN_ID_HEX,
  policies: POLICIES,
});

export type ReadAccount = { address: string | null; chainId: string | null; active: boolean };

async function ensureConnected() {
  const c: any = controller;
  let acc =
    (await c.getActiveAccount?.({ preferSession: true })) ||
    (await c.getSessionAccount?.()) ||
    (await c.session?.getAccount?.());
  if (!acc) {
    acc = await c.connect?.();
  }
  if (acc) cacheWalletAccount(acc);
  return acc;
}

// ---------- Session helpers ----------
// Accepts the RULES ARRAY you build in your hook (contract-allow / max-fee / expires-in / chain)
export async function startSession(rules: any[]) {
  const hasContractAllow = rules.some((r) => r?.kind === "contract-allow");
  if (!hasContractAllow) {
    throw new Error(
      "[GG] No contract-allow rules. Set VITE_SPIRIT_ADDRESS and/or VITE_ACTIONS_ADDRESS (and/or VITE_WORLD_ADDRESS)."
    );
  }
  if (!rules.some((r) => r?.kind === "chain")) {
    rules.push({ kind: "chain", id: CHAIN_ID_HEX });
  }

  const acc = await ensureConnected();
  cacheWalletAccount(acc);

  const c: any = controller;
  const req = await (
    c.session?.request?.({ policies: rules }) ??
    c.requestSession?.({ policies: rules }) ??
    c.enableSession?.(rules)
  );

  const active = await c.session?.isActive?.();
  if (!active) {
    warn("Session request returned:", req);
    throw new Error(
      "[GG] Failed to activate session. Possible causes: wrong chain id, missing addresses (no contract-allow), pop-up blocked, or cartridge.gg blocked by extensions."
    );
  }
  return true;
}

export async function readAccount(): Promise<ReadAccount> {
  const c: any = controller;
  let acc =
    (await c.getActiveAccount?.({ preferSession: true })) ||
    (await c.getSessionAccount?.()) ||
    (await c.session?.getAccount?.()) ||
    (await c.getActiveAccount?.());

  if (!acc && LAST_WALLET_ACC) acc = LAST_WALLET_ACC;

  const address: string | null =
    acc?.address ??
    acc?.account?.address ??
    acc?.signer?.address ??
    (typeof acc?.getAddress === "function" ? await acc.getAddress() : null) ??
    (await getLastWalletAddress()) ??
    null;

  let chainId: string | null = null;
  try {
    const raw =
      (await acc?.getChainId?.()) ?? acc?.chainId ?? acc?.provider?.chainId ?? null;
    chainId =
      typeof raw === "string" ? raw :
      raw ? String(raw) :
      null;
  } catch {}

  return { address, chainId, active: !!address };
}

export async function isSessionActive(): Promise<boolean> {
  const c: any = controller;
  return !!(await c.session?.isActive?.());
}

async function probe() {
  const c: any = controller;
  const active = await c.session?.isActive?.();
  const acc   = await c.getActiveAccount?.({ preferSession: true });
  const sacc1 = await c.getSessionAccount?.();
  const sacc2 = await c.session?.getAccount?.();
  const addr =
    acc?.address ?? acc?.account?.address ?? acc?.signer?.address ??
    sacc1?.address ?? sacc2?.address ?? null;

  let cid: any = null;
  try { cid = (await acc?.getChainId?.()) ?? acc?.chainId ?? acc?.provider?.chainId ?? null; } catch {}

  d("PROBE", { sessionActive: !!active, activeAccount: !!acc, addr, chainId: cid, sacc1: !!sacc1, sacc2: !!sacc2 });
}

expose("controller", controller);
expose("__ggProbe", probe);
warn("tip: open DevTools, run localStorage.setItem('gg_debug','1'); location.reload(); then __ggProbe()");
export default controller;
