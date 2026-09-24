/** The Graph Network IDs for Arc Pad → Open Market */
export const ARGUS_SUBGRAPH_ID =
  "JBG4rStwjXA3XbD8K4NVJddcjPMGpNgsQPNm3KZdD2GW";

/** Uni V4 Arc — tip-fresh (Pool.hooks string, no Hook entity) */
export const UNI_ARC_SUBGRAPH_ID =
  "7xLobfNG9xx8yM5hkxagRuPmdjCJP4Kj9vtomrn9LrRM";

/** Uni V4 Arc — hooks-enhanced deployment (lagged, has Hook entity) */
export const UNI_HOOKS_IPFS =
  "Qmdyx7tqmQzyQu7viYqqfE3oNYs8EtxhcPs1VHBfXi7p2p";

/** One-click demo tokens — real bonded Arc launches */
export const EXAMPLES = [
  {
    id: "0x41358defd0dedc90528b3f1835715e907b686e6a",
    label: "DUKE",
    blurb: "Hooked pad → same hook on Uni",
    tag: "hook continuity",
  },
  {
    id: "0xece5ca8bf9220718e5727754026757512212cb3c",
    label: "ARGUS",
    blurb: "Legacy pad → vanilla Uni books",
    tag: "legacy",
  },
  {
    id: "0x93d5b8c53ee763c2c4522bf0d958ce51af4360ae",
    label: "REGI",
    blurb: "Recent hooked graduate · solid pad volume",
    tag: "bonded grad",
  },
  {
    id: "0x09f4f85b8428a451222be6c121883ae6ecedbf1f",
    label: "AQUA",
    blurb: "High-activity hooked graduate",
    tag: "bonded grad",
  },
  {
    id: "0x06e0ec452120316fcb0240a20aa461e0a1a7b329",
    label: "WICKET",
    blurb: "Hooked pad with open-market pool",
    tag: "bonded grad",
  },
] as const;

/** Default featured set loaded on refresh (same as examples) */
export const FEATURED = EXAMPLES;

export const API_KEY_STORAGE = "pom_graph_api_key";
