import {
  ARGUS_SUBGRAPH_ID,
  UNI_ARC_SUBGRAPH_ID,
  UNI_HOOKS_IPFS,
} from "./config";

type GqlVars = Record<string, unknown>;

type GqlTarget =
  | { subgraphId: string; ipfsHash?: never }
  | { ipfsHash: string; subgraphId?: never };

async function gqlDirect(
  apiKey: string,
  target: GqlTarget,
  query: string,
  variables?: GqlVars,
): Promise<unknown> {
  const path = target.subgraphId
    ? `subgraphs/id/${target.subgraphId}`
    : `deployments/id/${target.ipfsHash}`;
  const url = `https://gateway.thegraph.com/api/${apiKey}/${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const json = (await res.json()) as {
    data?: unknown;
    errors?: { message: string }[];
  };
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  }
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }
  return json.data;
}

async function gqlProxy(
  target: GqlTarget,
  query: string,
  variables?: GqlVars,
): Promise<unknown> {
  const res = await fetch("/api/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...target, query, variables }),
  });
  const json = (await res.json()) as {
    data?: unknown;
    errors?: { message: string }[];
    error?: string;
  };
  if (!res.ok) {
    throw new Error(
      json.error ||
        `Demo proxy HTTP ${res.status}: ${JSON.stringify(json).slice(0, 300)}`,
    );
  }
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }
  return json.data;
}

/** Empty / missing apiKey → Vercel demo proxy; otherwise call gateway with the user's key. */
async function gql(
  apiKey: string,
  target: GqlTarget,
  query: string,
  variables?: GqlVars,
): Promise<unknown> {
  const key = apiKey.trim();
  if (key) return gqlDirect(key, target, query, variables);
  return gqlProxy(target, query, variables);
}

export type Launch = {
  id: string;
  symbol: string;
  name?: string | null;
  bonded: boolean;
  line: string | null;
  hook: string | null;
  poolId: string | null;
  swapCount: string;
  volumeQuote: string;
  holderCount: number;
  quoteSymbol?: string | null;
};

export type HookInfo = {
  id: string;
  hasCustomAccounting: boolean;
  permissions: number;
  beforeSwap: boolean;
  afterSwap: boolean;
  beforeSwapReturnsDelta: boolean;
  afterSwapReturnsDelta: boolean;
  volumeUSD: string;
  poolCount?: string;
};

export type UniPool = {
  id: string;
  volumeUSD: string;
  txCount: string;
  feeTier: string;
  totalValueLockedUSD?: string;
  hooks?: string | null;
  hook?: HookInfo | null;
  token0?: { symbol: string; id: string };
  token1?: { symbol: string; id: string };
};

export type UniToken = {
  id: string;
  symbol: string;
  volumeUSD: string;
  txCount: string;
  totalValueLockedUSD?: string;
};

export type LifecycleRow = {
  launch: Launch;
  tipPool: UniPool | null;
  tipToken: UniToken | null;
  hooksPool: UniPool | null;
  hookEntity: HookInfo | null;
  hooksMeta: { block: number; lagNote: string } | null;
  tipMeta: { block: number } | null;
  error?: string;
};

const LAUNCH_FIELDS = `
  id symbol name bonded line hook poolId
  swapCount volumeQuote holderCount quoteSymbol
`;

export async function fetchFeaturedLaunches(apiKey: string, ids: string[]) {
  const data = (await gql(
    apiKey,
    { subgraphId: ARGUS_SUBGRAPH_ID },
    `query($ids: [ID!]!) {
      launches(where: { id_in: $ids }) { ${LAUNCH_FIELDS} }
    }`,
    { ids },
  )) as { launches: Launch[] };
  return data.launches;
}

export async function fetchRecentBonded(apiKey: string, first = 20) {
  const data = (await gql(
    apiKey,
    { subgraphId: ARGUS_SUBGRAPH_ID },
    `query($first: Int!) {
      launches(
        where: { bonded: true }
        first: $first
        orderBy: bondedAt
        orderDirection: desc
      ) { ${LAUNCH_FIELDS} }
    }`,
    { first },
  )) as { launches: Launch[] };
  return data.launches;
}

export async function fetchUniTipJoin(
  apiKey: string,
  tokenId: string,
  poolId: string | null,
) {
  const token = tokenId.toLowerCase();
  type TipResult = {
    _meta: { block: { number: number } };
    token: UniToken | null;
    pool: UniPool | null;
    pools: UniPool[];
  };

  if (poolId) {
    return (await gql(
      apiKey,
      { subgraphId: UNI_ARC_SUBGRAPH_ID },
      `query($token: ID!, $pool: ID!) {
        _meta { block { number } }
        token(id: $token) {
          id symbol volumeUSD txCount totalValueLockedUSD
        }
        pool(id: $pool) {
          id volumeUSD txCount feeTier totalValueLockedUSD hooks
          token0 { id symbol }
          token1 { id symbol }
        }
        pools(
          where: { or: [{ token0: $token }, { token1: $token }] }
          orderBy: volumeUSD
          orderDirection: desc
          first: 3
        ) {
          id volumeUSD txCount feeTier hooks
          token0 { id symbol }
          token1 { id symbol }
        }
      }`,
      { token, pool: poolId },
    )) as TipResult;
  }

  const data = (await gql(
    apiKey,
    { subgraphId: UNI_ARC_SUBGRAPH_ID },
    `query($token: ID!) {
      _meta { block { number } }
      token(id: $token) {
        id symbol volumeUSD txCount totalValueLockedUSD
      }
      pools(
        where: { or: [{ token0: $token }, { token1: $token }] }
        orderBy: volumeUSD
        orderDirection: desc
        first: 3
      ) {
        id volumeUSD txCount feeTier hooks
        token0 { id symbol }
        token1 { id symbol }
      }
    }`,
    { token },
  )) as Omit<TipResult, "pool">;
  return { ...data, pool: null };
}

export async function fetchUniHooksJoin(
  apiKey: string,
  tokenId: string,
  poolId: string | null,
  hookAddr: string | null,
) {
  const token = tokenId.toLowerCase();
  const parts: string[] = [
    `_meta { block { number } hasIndexingErrors }`,
    `token(id: $token) { id symbol volumeUSD txCount totalValueLockedUSD }`,
  ];
  const vars: GqlVars = { token };
  const varDefs = ["$token: ID!"];

  if (poolId) {
    varDefs.push("$pool: ID!");
    vars.pool = poolId;
    parts.push(`pool(id: $pool) {
      id volumeUSD txCount feeTier totalValueLockedUSD
      hook {
        id hasCustomAccounting permissions
        beforeSwap afterSwap
        beforeSwapReturnsDelta afterSwapReturnsDelta
        volumeUSD
      }
      token0 { id symbol }
      token1 { id symbol }
    }`);
  }
  if (hookAddr) {
    varDefs.push("$hook: ID!");
    vars.hook = hookAddr.toLowerCase();
    parts.push(`hook(id: $hook) {
      id hasCustomAccounting permissions
      beforeSwap afterSwap
      beforeSwapReturnsDelta afterSwapReturnsDelta
      volumeUSD poolCount
    }`);
  }

  return (await gql(
    apiKey,
    { ipfsHash: UNI_HOOKS_IPFS },
    `query(${varDefs.join(", ")}) { ${parts.join("\n")} }`,
    vars,
  )) as {
    _meta: { block: { number: number }; hasIndexingErrors: boolean };
    token: UniToken | null;
    pool?: UniPool | null;
    hook?: HookInfo | null;
  };
}

export async function buildLifecycleRow(
  apiKey: string,
  launch: Launch,
): Promise<LifecycleRow> {
  try {
    const tip = await fetchUniTipJoin(apiKey, launch.id, launch.poolId);
    let hooksPool: UniPool | null = null;
    let hookEntity: HookInfo | null = null;
    let hooksMeta: LifecycleRow["hooksMeta"] = null;
    let hooksErr: string | undefined;

    try {
      const hooks = await fetchUniHooksJoin(
        apiKey,
        launch.id,
        launch.poolId,
        launch.hook,
      );
      hooksPool = hooks.pool ?? null;
      hookEntity = hooks.hook ?? hooksPool?.hook ?? null;
      const tipBlock = tip._meta.block.number;
      const hooksBlock = hooks._meta.block.number;
      const lag = tipBlock - hooksBlock;
      hooksMeta = {
        block: hooksBlock,
        lagNote:
          lag > 1000
            ? `hooks IPFS ~${Math.round(lag / 1000)}k blocks behind tip`
            : "hooks near tip",
      };
    } catch (e) {
      hooksErr = e instanceof Error ? e.message : String(e);
    }

    const tipPool =
      tip.pool ??
      tip.pools.find(
        (p) =>
          p.hooks &&
          launch.hook &&
          p.hooks.toLowerCase() === launch.hook.toLowerCase(),
      ) ??
      tip.pools[0] ??
      null;

    return {
      launch,
      tipPool,
      tipToken: tip.token,
      hooksPool,
      hookEntity,
      hooksMeta,
      tipMeta: { block: tip._meta.block.number },
      error: hooksErr ? `Hooks deploy: ${hooksErr}` : undefined,
    };
  } catch (e) {
    return {
      launch,
      tipPool: null,
      tipToken: null,
      hooksPool: null,
      hookEntity: null,
      hooksMeta: null,
      tipMeta: null,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
