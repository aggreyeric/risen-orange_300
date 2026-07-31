import type { AuctionView } from "../types";
import { AuctionCard } from "./AuctionCard";

export function AuctionGrid({
  auctions,
  onSelect,
}: {
  auctions: AuctionView[];
  onSelect: (a: AuctionView) => void;
}) {
  if (auctions.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="text-5xl mb-4 opacity-30">📭</div>
        <p className="text-white/40 text-lg">No auctions here yet.</p>
        <p className="text-white/30 text-sm mt-1">Create one to get started!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 animate-fade-in">
      {auctions.map((a) => (
        <AuctionCard key={a.id} auction={a} onClick={() => onSelect(a)} />
      ))}
    </div>
  );
}
