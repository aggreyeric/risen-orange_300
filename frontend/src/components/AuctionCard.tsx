import type { AuctionView } from "../types";
import { useApp } from "../context/AppContext";
import { formatXlm, shortAddr, timeRemaining, isEnding, isEnded } from "../lib/format";
import { useCountdown } from "../hooks/useCountdown";

export function AuctionCard({ auction, onClick }: { auction: AuctionView; onClick: () => void }) {
  useCountdown();
  const { wallet } = useApp();
  const ended = isEnded(auction.endTime);
  const ending = isEnding(auction.endTime);
  const youWin = auction.highestBidder === wallet.state.address;

  return (
    <div
      onClick={onClick}
      className="glass rounded-2xl p-5 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-brand-600/10 animate-fade-in group"
    >
      {/* Status badge */}
      <div className="flex items-center justify-between mb-4">
        {auction.settled ? (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/5 text-white/50 border border-white/10">
            ✅ Settled
          </span>
        ) : ended ? (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
            ⏰ Awaiting Settlement
          </span>
        ) : ending ? (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse">
            🔥 Ending Soon
          </span>
        ) : (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
            🟢 Live
          </span>
        )}
        <span className="text-xs text-white/30 font-mono">#{auction.id}</span>
      </div>

      {/* Item name */}
      <h3 className="text-base font-bold text-white mb-1 group-hover:text-brand-400 transition-colors">
        {auction.itemName}
      </h3>
      <p className="text-xs text-white/40 mb-4">
        by <span className="font-mono">{shortAddr(auction.seller)}</span>
      </p>

      {/* Bids */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-ink-900/60 rounded-xl p-3">
          <p className="text-[10px] text-white/40 uppercase tracking-wide mb-1">
            {auction.highestBid > 0 ? "Highest Bid" : "Starting Price"}
          </p>
          <p className="text-lg font-bold text-white">
            {formatXlm(auction.highestBid > 0 ? auction.highestBid : auction.startingPrice)}{" "}
            <span className="text-xs text-white/40">XLM</span>
          </p>
        </div>
        <div className="bg-ink-900/60 rounded-xl p-3">
          <p className="text-[10px] text-white/40 uppercase tracking-wide mb-1">Bids</p>
          <p className="text-lg font-bold text-white">{auction.bidCount}</p>
        </div>
      </div>

      {/* Bottom row */}
      <div className="flex items-center justify-between text-xs">
        {auction.highestBidder ? (
          <span className={youWin ? "text-accent-400 font-semibold" : "text-white/40"}>
            {youWin ? "🏆 You're winning!" : `Top: ${shortAddr(auction.highestBidder)}`}
          </span>
        ) : (
          <span className="text-white/30">No bids yet</span>
        )}
        {!auction.settled && (
          <span className={ending ? "text-red-400 font-semibold" : "text-white/50"}>
            {ended ? "Ended" : `⏱ ${timeRemaining(auction.endTime)}`}
          </span>
        )}
      </div>
    </div>
  );
}
