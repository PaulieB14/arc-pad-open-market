import type { VercelRequest, VercelResponse } from "@vercel/node";

/** Allowlist — must match src/lib/config.ts Argus / Uni tip / hooks IDs */
const ALLOWED_SUBGRAPH_IDS = new Set([
  "JBG4rStwjXA3XbD8K4NVJddcjPMGpNgsQPNm3KZdD2GW", // Argus
  "7xLobfNG9xx8yM5hkxagRuPmdjCJP4Kj9vtomrn9LrRM", // Uni V4 Arc tip
]);

const ALLOWED_IPFS_HASHES = new Set([
  "Qmdyx7tqmQzyQu7viYqqfE3oNYs8EtxhcPs1VHBfXi7p2p", // Uni V4 Arc hooks-enhanced
]);

type Body = {
  subgraphId?: string;
  ipfsHash?: string;
  query?: string;
  variables?: Record<string, unknown>;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  const key = process.env.GRAPH_STUDIO_API_KEY;
  if (!key) {
    return res.status(503).json({
      error: "Demo proxy unavailable — set GRAPH_STUDIO_API_KEY on the host.",
    });
  }

  const body = (typeof req.body === "string" ? JSON.parse(req.body) : req.body) as Body;
  const { subgraphId, ipfsHash, query, variables } = body ?? {};

  if (!query || typeof query !== "string") {
    return res.status(400).json({ error: "Missing GraphQL query" });
  }
  if (Boolean(subgraphId) === Boolean(ipfsHash)) {
    return res
      .status(400)
      .json({ error: "Provide exactly one of subgraphId or ipfsHash" });
  }

  let gatewayPath: string;
  if (subgraphId) {
    if (typeof subgraphId !== "string" || !ALLOWED_SUBGRAPH_IDS.has(subgraphId)) {
      return res.status(403).json({ error: "subgraphId not allowlisted" });
    }
    gatewayPath = `subgraphs/id/${subgraphId}`;
  } else {
    if (typeof ipfsHash !== "string" || !ALLOWED_IPFS_HASHES.has(ipfsHash!)) {
      return res.status(403).json({ error: "ipfsHash not allowlisted" });
    }
    gatewayPath = `deployments/id/${ipfsHash}`;
  }

  const url = `https://gateway.thegraph.com/api/${key}/${gatewayPath}`;
  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });
    const text = await upstream.text();
    res.setHeader("Content-Type", "application/json");
    return res.status(upstream.status).send(text);
  } catch (e) {
    return res.status(502).json({
      error: e instanceof Error ? e.message : "Upstream gateway error",
    });
  }
}
