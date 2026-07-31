import { useState, useCallback } from "react";
import type { WalletState } from "../types";
import { DEMO_MODE } from "../lib/config";

/**
 * Freighter injects a `window.freighterApi` object. We declare a minimal
 * interface here to avoid pulling in the heavy @stellar/freighter-api package.
 */
interface FreighterApi {
  isConnected: () => Promise<boolean>;
  getPublicKey: () => Promise<string>;
  signTransaction: (
    xdr: string,
    opts?: { networkPassphrase?: string }
  ) => Promise<string>;
  setAllowed: () => Promise<boolean>;
}

declare global {
  interface Window {
    freighterApi?: FreighterApi;
  }
}

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    connected: DEMO_MODE,
    address: DEMO_MODE ? "GDEMO…F7KQ2M" : null,
  });

  const connect = useCallback(async () => {
    if (DEMO_MODE) {
      setState({ connected: true, address: "GDEMO…F7KQ2M" });
      return;
    }

    const api = window.freighterApi;
    if (!api) {
      alert("Freighter wallet not found. Install the Freighter extension to bid.");
      return;
    }

    try {
      const allowed = await api.setAllowed();
      if (!allowed) {
        alert("Please allow this site in Freighter settings.");
        return;
      }
      const address = await api.getPublicKey();
      setState({ connected: true, address });
    } catch (err) {
      console.error("Wallet connect error:", err);
      alert("Failed to connect wallet.");
    }
  }, []);

  const disconnect = useCallback(() => {
    setState({ connected: false, address: null });
  }, []);

  return { state, connect, disconnect };
}
