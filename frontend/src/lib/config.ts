export const DEMO_MODE: boolean =
  import.meta.env.VITE_DEMO_MODE === "true" ||
  import.meta.env.VITE_DEMO_MODE === undefined;

export const RPC_URL = import.meta.env.VITE_SOROBAN_RPC_URL ?? "";
export const NETWORK_PASSPHRASE =
  import.meta.env.VITE_NETWORK_PASSPHRASE ?? "Test SDF Network ; September 2015";
export const REGISTRY_CONTRACT_ID = import.meta.env.VITE_REGISTRY_CONTRACT_ID ?? "";

export const EXPLORER_BASE = "https://stellar.expert/explorer/testnet";
