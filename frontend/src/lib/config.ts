/**
 * Live Soroban contract configuration (Stellar TESTNET).
 *
 * Registry contract:  deployed + initialized, manages auction lifecycle.
 * Auction instances:  deployed separately, each tracks one auction's bids.
 */

export const DEMO_MODE: boolean =
  import.meta.env.VITE_DEMO_MODE === "true" ||
  import.meta.env.VITE_DEMO_MODE === undefined;

export const RPC_URL =
  import.meta.env.VITE_SOROBAN_RPC_URL ?? "https://soroban-testnet.stellar.org:443";
export const NETWORK_PASSPHRASE =
  import.meta.env.VITE_NETWORK_PASSPHRASE ?? "Test SDF Network ; September 2015";

/** Live-deployed Registry contract on testnet. */
export const REGISTRY_CONTRACT_ID =
  import.meta.env.VITE_REGISTRY_CONTRACT_ID ??
  "CAHHJV2EHV4FRDNWSE5QIFXAISCDTRR2TJKP5NRPDBBGJYDVRA5UPDAB";

/** Native XLM SAC address — the accepted payment token. */
export const NATIVE_XLM_SAC =
  "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

export const EXPLORER_BASE = "https://stellar.expert/explorer/testnet";

/** A funded testnet account used as a read-only source for simulations. */
export const READ_SOURCE_PUBKEY =
  "GBQYOTSQKR5OBD6PGMKYIU644TZFBC4EKKE4R75YD5LBLXWA3DN6IZRF";

export const POLL_INTERVAL_MS = 8000;
