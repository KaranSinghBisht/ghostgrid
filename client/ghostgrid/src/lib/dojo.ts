import controller, { CHAIN_ID_HEX, getLastWalletAccount, getLastWalletAddress } from "../chain/controller";

const ENV: Record<string, any> =
  typeof import.meta !== "undefined" ? ((import.meta as any).env || {}) : {};

const WORLD   = ENV.VITE_WORLD_ADDRESS as string | undefined;
const ACTIONS = ENV.VITE_ACTIONS_ADDRESS as string | undefined;
const SPIRIT  = ENV.VITE_SPIRIT_ADDRESS  as string | undefined;

const ACTIONS_ENTRYPOINTS = new Set(["spawn"]);
const SPIRIT_ENTRYPOINTS  = ["start_run","move","use_thermo","use_uv","use_emf","use_spirit","use_writing","use_prop","guess"];

const FORCE_WALLET = ENV.VITE_FORCE_WALLET === "1";

function pickContract(entrypoint: string) {
  const addr = ACTIONS_ENTRYPOINTS.has(entrypoint) ? ACTIONS : SPIRIT;
  if (!addr) throw new Error(`[GG] Missing address for ${entrypoint}`);
  return addr;
}

async function ensureSessionActive() {
  if (FORCE_WALLET) {
    console.warn("[GG] FORCE_WALLET=1 -> skipping session");
    return false;
  }

  const c: any = controller;
  const active = await c.session?.isActive?.();
  console.warn("[GG] ensureSessionActive -> active?", !!active);
  if (active) return true;

  const policies = [
    ...(SPIRIT  ? [{ kind: "contract-allow", address: SPIRIT,  entrypoints: SPIRIT_ENTRYPOINTS }] : []),
    ...(ACTIONS ? [{ kind: "contract-allow", address: ACTIONS, entrypoints: ["spawn"] }] : []),
    ...(WORLD   ? [{ kind: "contract-allow", address: WORLD,   entrypoints: ["execute"] }] : []),
    { kind: "max-fee", wei: (ENV.VITE_SESSION_MAX_FEE_WEI as string) || "5000000000000000" },
    { kind: "rate-limit", maxCalls: Number(ENV.VITE_SESSION_MAX_CALLS ?? 100), perSeconds: 60 },
    { kind: "expires-in", seconds: Number(ENV.VITE_SESSION_TTL ?? 1800) },
    { kind: "chain", id: CHAIN_ID_HEX },
  ];

  if (!policies.some((p) => (p as any).kind === "contract-allow")) {
    throw new Error("[GG] No contract-allow rules. Set VITE_SPIRIT_ADDRESS / VITE_ACTIONS_ADDRESS / VITE_WORLD_ADDRESS.");
  }

  console.warn("[GG] requesting session with policies:", policies);

  // make sure a wallet is connected
  const acc = await c.getActiveAccount?.({ preferSession: true });
  if (!acc) await c.connect?.();

  await (
    c.session?.request?.({ policies }) ??
    c.requestSession?.({ policies }) ??
    c.enableSession?.(policies)
  );

  const nowActive = await c.session?.isActive?.();
  console.warn("[GG] session now active?", !!nowActive);
  return !!nowActive;
}

async function getExecutor(acc?: any) {
  const c: any = controller;
  const sess = c.session;

  if (!FORCE_WALLET && sess?.execute) {
    console.warn("[GG] getExecutor -> using session.execute");
    return (call: any) => sess.execute(call);
  }

  if (!FORCE_WALLET) {
    const sessAcc =
      (await c.getSessionAccount?.()) ||
      (await sess?.getAccount?.()) ||
      sess?.account ||
      (await c.getActiveAccount?.({ preferSession: true }));

    if (sessAcc?.execute) {
      console.warn("[GG] getExecutor -> using sessionAccount.execute");
      return (call: any) => sessAcc.execute(call);
    }
  }

  if (acc?.execute) {
    console.warn("[GG] getExecutor -> using provided wallet account.execute (fallback)");
    return (call: any) => acc.execute(call);
  }

  const walletAcc = await c.getActiveAccount?.();
  if (walletAcc?.execute) {
    console.warn("[GG] getExecutor -> using controller.getActiveAccount().execute (wallet)");
    return (call: any) => walletAcc.execute(call);
  }

  throw new Error("[GG] No suitable executor found.");
}

export async function exec(entrypoint: string, calldata: any[] = []) {
  const c: any = controller;

  let acc =
    (await c.getActiveAccount?.({ preferSession: !FORCE_WALLET })) ||
    (await c.getSessionAccount?.()) ||
    (await c.session?.getAccount?.()) ||
    (await c.connect?.());

  if (!acc) acc = getLastWalletAccount();

  let cid: string | null = null;
  try {
    const raw =
      (await acc?.getChainId?.()) ??
      acc?.chainId ??
      acc?.provider?.chainId ??
      (await c.getChainId?.()) ??
      null;
    cid = typeof raw === "string" ? raw : raw ? String(raw) : null;
  } catch {}

  // normalize: some wallets report "SN_SEPOLIA", some hex
  if (cid === "SN_SEPOLIA") cid = CHAIN_ID_HEX;
  if (cid && cid !== CHAIN_ID_HEX) {
    throw new Error(`Wrong chain: ${cid}. Need SN_SEPOLIA (${CHAIN_ID_HEX}).`);
  }

  if (!SPIRIT || !ACTIONS) {
    throw new Error("[GG] Missing SPIRIT/ACTIONS address in env.");
  }

  await ensureSessionActive();

  const execute = await getExecutor(acc);
  const call = { contractAddress: pickContract(entrypoint), entrypoint, calldata };

  console.warn("[GG] sending call:", call);
  const res = await execute(call);
  console.warn("[GG] execute() result:", res);
  return res;
}
