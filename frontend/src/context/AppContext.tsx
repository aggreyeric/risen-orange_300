import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import type { AuctionView, AuctionEvent, TxResult } from "../types";
import { service } from "../lib/service";
import { useWallet } from "../hooks/useWallet";

interface AppContextValue {
  auctions: AuctionView[];
  events: AuctionEvent[];
  wallet: ReturnType<typeof useWallet>;
  loading: boolean;
  refresh: () => Promise<void>;
  createAuction: (itemName: string, startingPrice: number, durationMinutes: number, onStatus: (s: TxResult) => void) => Promise<TxResult>;
  placeBid: (auctionId: number, amount: number, onStatus: (s: TxResult) => void) => Promise<TxResult>;
  settleAuction: (auctionId: number, onStatus: (s: TxResult) => void) => Promise<TxResult>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const wallet = useWallet();
  const [auctions, setAuctions] = useState<AuctionView[]>([]);
  const [events, setEvents] = useState<AuctionEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const all = await service.listAll();
    setAuctions(all);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const unsub = service.subscribeEvents((event) => {
      setEvents((prev) => [event, ...prev].slice(0, 50));
      refresh();
    });
    return unsub;
  }, [refresh]);

  const createAuction = useCallback(
    async (itemName: string, startingPrice: number, durationMinutes: number, onStatus: (s: TxResult) => void) => {
      const result = await service.createAuction(
        { itemName, startingPrice, durationMinutes },
        wallet.state.address ?? "GUNKNOWN",
        onStatus
      );
      await refresh();
      return result;
    },
    [wallet.state.address, refresh]
  );

  const placeBid = useCallback(
    async (auctionId: number, amount: number, onStatus: (s: TxResult) => void) => {
      const result = await service.placeBid(auctionId, amount, wallet.state.address ?? "GUNKNOWN", onStatus);
      await refresh();
      return result;
    },
    [wallet.state.address, refresh]
  );

  const settleAuction = useCallback(
    async (auctionId: number, onStatus: (s: TxResult) => void) => {
      const result = await service.settleAuction(auctionId, onStatus);
      await refresh();
      return result;
    },
    [refresh]
  );

  const value: AppContextValue = {
    auctions,
    events,
    wallet,
    loading,
    refresh,
    createAuction,
    placeBid,
    settleAuction,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
