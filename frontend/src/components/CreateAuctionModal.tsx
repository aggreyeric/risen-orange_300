import { useState } from "react";
import type { TxResult } from "../types";
import { useApp } from "../context/AppContext";

export function CreateAuctionModal({ onClose }: { onClose: () => void }) {
  const { createAuction } = useApp();
  const [itemName, setItemName] = useState("");
  const [startingPrice, setStartingPrice] = useState("");
  const [duration, setDuration] = useState("60");
  const [status, setStatus] = useState<TxResult>({ status: "idle" });
  const [error, setError] = useState("");

  const busy = ["preparing", "signing", "submitting", "pending"].includes(status.status);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!itemName.trim()) return setError("Item name is required");
    const price = parseFloat(startingPrice);
    if (!price || price <= 0) return setError("Starting price must be > 0");
    const dur = parseInt(duration);
    if (!dur || dur < 1) return setError("Duration must be at least 1 minute");

    const result = await createAuction(itemName.trim(), price, dur, setStatus);
    if (result.status === "success") {
      onClose();
    } else if (result.status === "failed") {
      setError(result.error ?? "Transaction failed");
      setStatus({ status: "idle" });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        className="glass rounded-2xl p-6 w-full max-w-md animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Create Auction</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-white/50 uppercase tracking-wide block mb-1.5">Item Name</label>
            <input
              type="text"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="e.g. Cosmic Genesis NFT #042"
              disabled={busy}
              className="w-full bg-ink-900/60 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/20 focus:border-brand-500 focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="text-xs text-white/50 uppercase tracking-wide block mb-1.5">Starting Price (XLM)</label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={startingPrice}
              onChange={(e) => setStartingPrice(e.target.value)}
              placeholder="e.g. 5.0"
              disabled={busy}
              className="w-full bg-ink-900/60 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/20 focus:border-brand-500 focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="text-xs text-white/50 uppercase tracking-wide block mb-1.5">Duration (minutes)</label>
            <div className="flex gap-2">
              {[30, 60, 180, 360].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDuration(String(d))}
                  disabled={busy}
                  className={`flex-1 py-2 text-sm rounded-lg transition-colors ${
                    duration === String(d)
                      ? "bg-brand-600/30 text-brand-400 border border-brand-500/40"
                      : "bg-ink-900/60 text-white/40 border border-white/10 hover:text-white/70"
                  }`}
                >
                  {d < 60 ? `${d}m` : `${d / 60}h`}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          {busy && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-brand-600/10 border border-brand-500/20">
              <div className="w-5 h-5 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
              <div>
                <p className="text-sm font-semibold text-brand-400 capitalize">{status.status}…</p>
                {status.hash && <p className="text-xs text-white/40 font-mono mt-0.5">{status.hash.slice(0, 20)}…</p>}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 rounded-lg font-semibold text-white bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 disabled:opacity-50 transition-all shadow-lg shadow-brand-600/20"
          >
            {busy ? "Processing…" : "🚀 Create Auction"}
          </button>
        </form>
      </div>
    </div>
  );
}
