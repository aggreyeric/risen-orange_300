import { useApp } from "../context/AppContext";
import { DEMO_MODE } from "../lib/config";
import { shortAddr } from "../lib/format";

export function Header({ onCreateClick }: { onCreateClick: () => void }) {
  const { wallet } = useApp();
  const { state, connect, disconnect } = wallet;

  return (
    <header className="sticky top-0 z-40 glass border-b border-brand-600/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center text-white text-lg shadow-lg shadow-brand-600/30">
            ⚖
          </div>
          <div>
            <h1 className="text-lg font-bold gradient-text leading-none">risen</h1>
            <p className="text-[10px] text-white/40 uppercase tracking-widest mt-0.5">Auction House</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {DEMO_MODE && (
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-accent-500/10 text-accent-400 border border-accent-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-400 animate-pulse" />
              Demo Mode
            </span>
          )}
          <button
            onClick={onCreateClick}
            className="px-3 sm:px-4 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white transition-all shadow-lg shadow-brand-600/20 hover:shadow-brand-600/40"
          >
            + Create
          </button>
          {state.connected ? (
            <button
              onClick={disconnect}
              className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg glass hover:bg-ink-700 transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-green-400" />
              <span className="font-mono text-xs hidden sm:inline">{shortAddr(state.address)}</span>
            </button>
          ) : (
            <button
              onClick={connect}
              className="px-4 py-2 text-sm font-semibold rounded-lg glass hover:bg-ink-700 transition-colors"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
