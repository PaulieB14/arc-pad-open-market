/** The Graph Network IDs for Arc Pad → Open Market */
export const ARGUS_SUBGRAPH_ID =
  "JBG4rStwjXA3XbD8K4NVJddcjPMGpNgsQPNm3KZdD2GW";

/** Uni V4 Arc — tip-fresh (Pool.hooks string, no Hook entity) */
export const UNI_ARC_SUBGRAPH_ID =
  "7xLobfNG9xx8yM5hkxagRuPmdjCJP4Kj9vtomrn9LrRM";

/** Uni V4 Arc — hooks-enhanced deployment (lagged, has Hook entity) */
export const UNI_HOOKS_IPFS =
  "Qmdyx7tqmQzyQu7viYqqfE3oNYs8EtxhcPs1VHBfXi7p2p";

export const FEATURED = [
  {
    id: "0x41358defd0dedc90528b3f1835715e907b686e6a",
    label: "DUKE",
    blurb: "Hooked pad → same hook on Uni",
  },
  {
    id: "0xece5ca8bf9220718e5727754026757512212cb3c",
    label: "ARGUS",
    blurb: "Legacy pad → vanilla Uni books",
  },
] as const;

export const API_KEY_STORAGE = "pom_graph_api_key";
