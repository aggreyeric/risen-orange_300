import { useState } from "react";
import type { AuctionView, TxResult } from "../types";
import { useApp } from "../context/AppContext";
import { formatXlm, shortAddr, timeRemaining, isEnding, isEnded } from "../lib/format";
import { useCountdown } from "../hooks/useCountdown";
import { getStatusLabel } from "../lib/service";
import { EXPLORER_BASE } from "../lib/config";

export function AuctionDetail({ auction, onClose }: { auction: AuctionView; onClose: () => void }) {
  useCountdown();
  const { placeBid, settleAuction } = useApp();
  const [bidAmount, setBidAmount] = useState("");
  const [status, setStatus] = useState<TxResult>({ status: "idle" });
  const [error, setError] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  const ended = isEnded(auction.endTime);
  const ending = isEnding(auction.endTime);
  const minBid = auction.highestBid > 0 ? auction.highestBid : auction.startingPrice;
  const busy = ["preparing", "signing", "submitting", "pending"].includes(status.status);

  const handleBid = async () => {
    setError("");
    const amount = parseFloat(bidAmount);
    if (!amount || amount <= 0) return setError("Enter a valid amount");
    const minStroops = minBid / 1e7;
    if (amount <= minStroops) return setError(`Bid must be > ${formatXlm(minBid)} XLM`);

    const result = await placeBid(auction.id, amount, setStatus);
    if (result.status === "success") {
      setShowSuccess(true);
      setBidAmount("");
      setTimeout(() => setShowSuccess(false), 5000);
    } else if (result.status === "failed") {
      setError(result.error ?? "Bid failed");
      setStatus({ status: "idle" });
    }
  };

  const handleSettle = async () => {
    setError("");
    const result = await settleAuction(auction.id, setStatus);
    if (result.status === "failed") {
      setError(result.error ?? "Settle failed");
      setStatus({ status: "idle" });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        className="glass rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white">{auction.itemName}</h2>
            <p className="text-sm text-white/40 mt-1">
              Auction #{auction.id} · Seller: <span className="font-mono">{shortAddr(auction.seller)}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white text-2xl leading-none">×</button>
        </div>

        {/* Status banner */}
        {auction.settled ? (
          <div className="rounded-xl p-4 mb-6 bg-brand-600/10 border border-brand-500/20 flex items-center gap-3">
            <span className="text-2xl">🏆</span>
            <div>
              <p className="font-semibold text-brand-400">Auction Settled</p>
              <p className="text-sm text-white/50">
                Winner: {shortAddr(auction.winner)} · Final: {formatXlm(auction.finalPrice)} XLM
              </p>
            </div>
          </div>
        ) : (
          <div className={`rounded-xl p-4 mb-6 border flex items-center justify-between ${
            ending ? "bg-red-500/10 border-red-500/20" : ended ? "bg-orange-500/10 border-orange-500/20" : "bg-green-500/10 border-green-500/20"
          }`}>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{ending ? "🔥" : ended ? "⏰" : "🟢"}</span>
              <div>
                <p className={`font-semibold ${ending ? "text-red-400" : ended ? "text-orange-400" : "text-green-400"}`}>
                  {ending ? "Ending Soon!" : ended ? "Ended — Ready to Settle" : "Auction Live"}
                </p>
                {!ended && <p className="text-sm text-white/50">Time remaining: <span className="font-mono font-bold">{timeRemaining(auction.endTime)}</span></p>}
              </div>
            </div>
          </div>
        )}

        {/* Bidding grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-ink-900/60 rounded-xl p-4">
            <p className="text-xs text-white/40 uppercase tracking-wide mb-1">Current Bid</p>
            <p className="text-2xl font-bold text-white">
              {formatXlm(auction.highestBid > 0 ? auction.highestBid : auction.startingPrice)}
              <span className="text-sm text-white/40 ml-1">XLM</span>
            </p>
            {auction.highestBidder && (
              <p className="text-xs text-white/40 mt-1 font-mono">{shortAddr(auction.highestBidder)}</p>
            )}
          </div>
          <div className="bg-ink-900/60 rounded-xl p-4">
            <p className="text-xs text-white/40 uppercase tracking-wide mb-1">Total Bids</p>
            <p className="text-2xl font-bold text-white">{auction.bidCount}</p>
            <p className="text-xs text-white/40 mt-1">Started at {formatXlm(auction.startingPrice)} XLM</p>
          </div>
        </div>

        {/* Bidding panel */}
        {!auction.settled && !ended && (
          <div className="space-y-3 mb-6">
            <label className="text-xs text-white/50 uppercase tracking-wide block">Place a Bid</label>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.1"
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                placeholder={`Min: ${(minBid / 1e7).toFixed(1)} XLM`}
                disabled={busy}
                onKeyDown={(e) => e.key === "Enter" && handleBid()}
                className="flex-1 bg-ink-900/60 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/20 focus:border-brand-500 focus:outline-none transition-colors"
              />
              <button
                onClick={handleBid}
                disabled={busy}
                className="px-6 py-3 rounded-lg font-semibold text-white bg-gradient-to-r from-accent-500 to-accent-400 hover:opacity-90 disabled:opacity-50 transition-all shadow-lg shadow-accent-500/20"
              >
                {busy ? "…" : "Bid Now"}
              </button>
            </div>
            <div className="flex gap-2">
              {[1.05, 1.1, 1.25].map((mult) => (
                <button
                  key={mult}
                  type="button"
                  onClick={() => setBidAmount(((minBid / 1e7) * mult).toFixed(2))}
                  disabled={busy}
                  className="px-3 py-1 text-xs rounded-md bg-ink-800 text-white/40 hover:text-white/70 border border-white/10 transition-colors"
                >
                  +{Math.round((mult - 1) * 100)}%
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Settle button */}
        {!auction.settled && ended && (
          <button
            onClick={handleSettle}
            disabled={busy}
            className="w-full py-3 rounded-lg font-semibold text-white bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 disabled:opacity-50 transition-all shadow-lg shadow-brand-600/20 mb-6"
          >
            {busy ? "Settling…" : "🏆 Settle Auction"}
          </button>
        )}

        {/* Transaction status */}
        {busy && (
          <div className="rounded-xl p-4 mb-6 bg-brand-600/10 border border-brand-500/20">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-5 h-5 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-semibold text-brand-400">{getStatusLabel(status.status)}</p>
            </div>
            {status.hash && (
              <a
                href={`${EXPLORER_BASE}/tx/${status.hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-accent-400 hover:underline font-mono break-all"
              >
                {status.hash.slice(0, 24)}… ↗
              </a>
            )}
          </div>
        )}

        {showSuccess && (
          <div className="rounded-xl p-4 mb-6 bg-green-500/10 border border-green-500/20 animate-fade-in">
            <div className="flex items-center gap-3">
              <span className="text-xl">✅</span>
              <div>
                <p className="text-sm font-semibold text-green-400">Bid confirmed!</p>
                {status.hash && (
                  <a
                    href={`${EXPLORER_BASE}/tx/${status.hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-accent-400 hover:underline font-mono"
                  >
                    View on Explorer ↗
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

        {/* Contract info */}
        <div className="border-t border-white/5 pt-4 mt-4">
          <p className="text-xs text-white/30">
            Auction Contract: <span className="font-mono text-white/40">{auction.auctionAddress}</span>
          </p>
          <p className="text-xs text-white/30 mt-1">
            Cross-contract calls: Registry ↔ Auction (initialize + register_settled)
          </p>
        </div>
      </div>
    </div>
  );
}
