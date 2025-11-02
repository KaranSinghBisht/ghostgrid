// src/lib/torii.ts

const ENV: Record<string, any> =
  typeof import.meta !== "undefined" ? ((import.meta as any).env || {}) : {};

const DEFAULT_TORII_BASE = "/torii";

const sanitizeBase = (value: string | undefined | null): string => {
  let base = (value ?? "").trim();
  if (!base) return DEFAULT_TORII_BASE;

  const stripTrailingSegment = (input: string, segment: string): string => {
    const suffix = `/${segment}`;
    if (input.endsWith(suffix)) return input.slice(0, -suffix.length);
    return input;
  };

  base = base.replace(/\/+$/, "");
  base = stripTrailingSegment(base, "graphql");
  base = stripTrailingSegment(base, "sql");
  base = base.replace(/\/+$/, "");

  return base || DEFAULT_TORII_BASE;
};

export const TORII_BASE = sanitizeBase(ENV.VITE_TORII_URL as string);
export const TORII_GRAPHQL = `${TORII_BASE}/graphql`;
export const TORII_SQL = `${TORII_BASE}/sql`;

// Backwards compatibility for older imports.
export const TORII_URL = TORII_GRAPHQL;

if (typeof window !== "undefined") {
  (window as any).__TORII_URL__ = TORII_GRAPHQL;
  console.info("[GG] TORII_GRAPHQL =", TORII_GRAPHQL);
}

export async function pingTorii(url: string = TORII_GRAPHQL) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: "query { events(limit: 3) { id name keys data createdAt } }" }),
  });
  if (!res.ok) throw new Error(`Torii HTTP ${res.status}`);
  const json = await res.json();
  if (json?.errors) throw new Error(`Torii GQL ${JSON.stringify(json.errors)}`);
  return json?.data?.events ?? [];
}

// ───────────────────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────────────────
export type PlayerRow = {
  address: string;
  best_score: number;
  total_runs: number;
  correct_guesses: number;
  sum_steps: number;
  sum_blocks: number;
};

export type TopPlayer = {
  address: string;
  totalRuns: number;
  totalWins: number;
  bestScore: number;
  totalSteps: number;
  totalBlocks: number;
  avgSteps: number;
  avgBlocks: number;
  winRate: number; // 0..1
};

// ───────────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────────
const toNum = (v: unknown, d = 0): number => {
  if (v === null || v === undefined) return d;
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

type GqlError = { message?: string };

async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(TORII_GRAPHQL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  let json: any;
  try {
    json = await res.json();
  } catch {
    throw new Error(`Torii returned non-JSON (status ${res.status}).`);
  }

  if (Array.isArray(json?.errors) && json.errors.length) {
    const msg = json.errors.map((e: GqlError) => e?.message).filter(Boolean).join("; ");
    throw new Error(msg || "Unknown GraphQL error from Torii.");
  }

  return json?.data as T;
}

// ───────────────────────────────────────────────────────────────────────────────
// API: single player
// ───────────────────────────────────────────────────────────────────────────────
export async function fetchPlayer(address: string): Promise<PlayerRow | null> {
  const q = `
    query ($keys: [String!]!, $first: Int) {
      entities(keys: $keys, first: $first) {
        edges {
          node {
            keys
            models {
              __typename
              ... on dojo_starter_Player {
                player
                best_score
                total_runs
                correct_guesses
                sum_steps
                sum_blocks
              }
            }
          }
        }
      }
    }
  `;

  type Resp = {
    entities?: {
      edges?: Array<{
        node?: {
          keys?: string[];
          models?: any[];
        };
      }>;
    };
  };

  const data = await gql<Resp>(q, { keys: [address], first: 1 });
  const edge = data?.entities?.edges?.[0];
  const node = edge?.node;
  if (!node) return null;

  const model = (node.models ?? []).find((m: any) => m?.__typename === "dojo_starter_Player");
  if (!model) return null;

  return {
    address: node.keys?.[0] ?? address,
    best_score: toNum(model.best_score),
    total_runs: toNum(model.total_runs),
    correct_guesses: toNum(model.correct_guesses),
    sum_steps: toNum(model.sum_steps),
    sum_blocks: toNum(model.sum_blocks),
  };
}

// ───────────────────────────────────────────────────────────────────────────────
// API: leaderboard
// ───────────────────────────────────────────────────────────────────────────────
export async function fetchTopPlayers(limit = 100): Promise<TopPlayer[]> {
  // No `model:` arg — we filter client-side for dojo_starter_Player
  const q = `
    query ($first: Int!) {
      entities(first: $first) {
        edges {
          node {
            keys
            models {
              __typename
              ... on dojo_starter_Player {
                player
                best_score
                total_runs
                correct_guesses
                sum_steps
                sum_blocks
              }
            }
          }
        }
      }
    }
  `;

  type Resp = {
    entities?: {
      edges?: Array<{
        node?: {
          keys?: string[];
          models?: any[];
        };
      }>;
    };
  };

  const data = await gql<Resp>(q, { first: 1000 });

  const edges = data?.entities?.edges ?? [];
  const rows: TopPlayer[] = [];

  for (const edge of edges) {
    const node = edge?.node;
    if (!node) continue;

    const address = node.keys?.[0];
    if (!address) continue;

    const model = (node.models ?? []).find((m: any) => m?.__typename === "dojo_starter_Player");
    if (!model) continue;

    const totalRuns   = toNum(model.total_runs);
    const totalWins   = toNum(model.correct_guesses);
    const totalSteps  = toNum(model.sum_steps);
    const totalBlocks = toNum(model.sum_blocks);
    const bestScore   = toNum(model.best_score);

    const avgSteps  = totalRuns ? totalSteps / totalRuns : 0;
    const avgBlocks = totalRuns ? totalBlocks / totalRuns : 0;
    const winRate   = totalRuns ? totalWins / totalRuns : 0;

    rows.push({
      address,
      totalRuns,
      totalWins,
      bestScore,
      totalSteps,
      totalBlocks,
      avgSteps,
      avgBlocks,
      winRate,
    });
  }

  rows.sort(
    (a, b) =>
      b.totalWins - a.totalWins ||
      b.bestScore - a.bestScore ||
      a.avgSteps - b.avgSteps ||
      a.avgBlocks - b.avgBlocks
  );

  return rows.slice(0, Math.max(1, limit));
}
