import { useState, useMemo } from "react";
import type { AuctionView } from "./types";
import { AppProvider, useApp } from "./context/AppContext";
import { Header } from "./components/Header";
import { AuctionGrid } from "./components/AuctionGrid";
import { EventFeed } from "./components/EventFeed";
import { CreateAuctionModal } from "./components/CreateAuctionModal";
import { AuctionDetail } from "./components/AuctionDetail";
import { DEMO_MODE } from "./lib/config";
import { isEnded } from "./lib/format";

function StatsBar({ auctions }: { auctions: AuctionView[] }) {
  const active = auctions.filter((a) => !a.settled && !isEnded(a.endTime));
  const settled = auctions.filter((a) => a.settled);
  const totalBids = auctions.reduce((sum, a) => sum + a.bidCount, 0);
  const totalVolume = auctions.reduce((sum, a) => sum + (a.finalPrice || a.highestBid), 0);

  const stats = [
    { label: "Active", value: active.length, icon: "🟢" },
    { label: "Settled", value: settled.length, icon: "🏆" },
    { label: "Total Bids", value: totalBids, icon: "🔨" },
    { label: "Volume", value: `${(totalVolume / 1e7).toFixed(0)}`, suffix: "XLM", icon: "💎" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {stats.map((s) => (
        <div key={s.label} className="glass rounded-xl p-4 text-center">
          <div className="text-xl mb-1">{s.icon}</div>
          <div className="text-2xl font-bold text-white">
            {s.value}
            {s.suffix && <span className="text-sm text-white/40 ml-1">{s.suffix}</span>}
          </div>
          <div className="text-xs text-white/40 uppercase tracking-wide">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

function AppContent() {
  const { auctions, events, loading } = useApp();
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<AuctionView | null>(null);
  const [tab, setTab] = useState<"active" | "all">("active");

  const filteredAuctions = useMemo(() => {
    if (tab === "active") return auctions.filter((a) => !a.settled);
    return auctions;
  }, [auctions, tab]);

  // Keep selected auction in sync with latest state
  const selectedLive = selected ? auctions.find((a) => a.id === selected.id) ?? selected : null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <Header onCreateClick={() => setShowCreate(true)} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Hero */}
        <div className="mb-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-1">
            Onchain <span className="gradient-text">Auction House</span>
          </h2>
          <p className="text-sm text-white/40">
            Two inter-communicating Soroban contracts — Registry ↔ Auction — powering real-time onchain bidding.
            {DEMO_MODE && " Running in simulated demo mode."}
          </p>
        </div>

        <StatsBar auctions={auctions} />

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => setTab("active")}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
              tab === "active" ? "bg-brand-600/30 text-brand-400 border border-brand-500/40" : "text-white/40 hover:text-white/70"
            }`}
          >
            🟢 Active ({auctions.filter((a) => !a.settled).length})
          </button>
          <button
            onClick={() => setTab("all")}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
              tab === "all" ? "bg-brand-600/30 text-brand-400 border border-brand-500/40" : "text-white/40 hover:text-white/70"
            }`}
          >
            📋 All ({auctions.length})
          </button>
        </div>

        {/* Main grid + sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          <div>
            <AuctionGrid auctions={filteredAuctions} onSelect={setSelected} />
          </div>
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <EventFeed events={events} />
          </aside>
        </div>
      </main>

      <footer className="max-w-7xl mx-auto px-4 sm:px-6 py-8 text-center">
        <p className="text-xs text-white/30">
          ⚖ risen Auction House · Built on Stellar Soroban · Cross-contract architecture
        </p>
      </footer>

      {showCreate && <CreateAuctionModal onClose={() => setShowCreate(false)} />}
      {selectedLive && <AuctionDetail auction={selectedLive} onClose={() => setSelected(null)} />}
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <div className="min-h-screen bg-ink-950">
        <AppContent />
      </div>
    </AppProvider>
  );
}
