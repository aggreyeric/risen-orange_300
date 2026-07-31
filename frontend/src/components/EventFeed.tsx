import type { AuctionEvent } from "../types";
import { formatXlm } from "../lib/format";

function timeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const EVENT_META = {
  bid_placed: { icon: "🔨", label: "Bid Placed", color: "text-accent-400" },
  auction_created: { icon: "✨", label: "New Auction", color: "text-green-400" },
  auction_settled: { icon: "🏆", label: "Settled", color: "text-brand-400" },
};

export function EventFeed({ events }: { events: AuctionEvent[] }) {
  return (
    <div className="glass rounded-2xl p-4 h-full">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <h3 className="text-sm font-bold text-white/80 uppercase tracking-wide">Live Events</h3>
      </div>

      {events.length === 0 ? (
        <p className="text-white/30 text-sm text-center py-8">Waiting for events…</p>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
          {events.map((e) => {
            const meta = EVENT_META[e.type];
            return (
              <div
                key={e.id}
                className="flex items-start gap-3 p-2.5 rounded-lg bg-ink-900/40 hover:bg-ink-900/70 transition-colors animate-slide-up"
              >
                <span className="text-lg mt-0.5">{meta.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    <span className={`font-semibold ${meta.color}`}>{meta.label}</span>
                    {" — "}
                    <span className="text-white/70 truncate">{e.itemName}</span>
                  </p>
                  <p className="text-xs text-white/40 mt-0.5">
                    {e.actor.slice(0, 12)}…
                    {e.amount && ` · ${formatXlm(e.amount)} XLM`}
                    {" · "}
                    {timeAgo(e.timestamp)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
