import { useState, useCallback } from "react";
import type { WalletState } from "../types";
import { DEMO_MODE } from "../lib/config";

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
    // In real mode, this would invoke StellarWalletsKit to open the wallet modal.
    // For now, simulate.
    setState({ connected: true, address: "GWALLET…9PM3KL" });
  }, []);

  const disconnect = useCallback(() => {
    if (DEMO_MODE) return;
    setState({ connected: false, address: null });
  }, []);

  return { state, connect, disconnect };
}
