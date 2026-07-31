/** Formatting helpers. */

export function formatXlm(stroops: number): string {
  const xlm = stroops / 1e7;
  if (xlm === 0) return "0";
  if (xlm < 0.01) return xlm.toFixed(7);
  return xlm.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function shortAddr(addr: string | null): string {
  if (!addr) return "—";
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function timeRemaining(endTime: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = endTime - now;
  if (diff <= 0) return "Ended";
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function isEnding(endTime: number): boolean {
  const diff = endTime - Math.floor(Date.now() / 1000);
  return diff > 0 && diff <= 300; // within 5 minutes
}

export function isEnded(endTime: number): boolean {
  return endTime - Math.floor(Date.now() / 1000) <= 0;
}
