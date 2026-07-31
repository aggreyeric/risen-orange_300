import type {
  AuctionView,
  AuctionEvent,
  CreateAuctionParams,
  TxResult,
  TxStatus,
} from "../types";
import { DEMO_MODE } from "./config";
import { seedAuctions, seedEvents, randomBackgroundEvent, randomTxHash } from "./demoData";

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * The AuctionService interface — the frontend talks to this, regardless of
 * whether we're in demo mode or connected to a live Soroban network.
 */
export interface AuctionService {
  listActive(): Promise<AuctionView[]>;
  listAll(): Promise<AuctionView[]>;
  createAuction(params: CreateAuctionParams, seller: string, onStatus: (s: TxResult) => void): Promise<TxResult>;
  placeBid(auctionId: number, amount: number, bidder: string, onStatus: (s: TxResult) => void): Promise<TxResult>;
  settleAuction(auctionId: number, onStatus: (s: TxResult) => void): Promise<TxResult>;
  subscribeEvents(cb: (e: AuctionEvent) => void): () => void;
}

// ---------------------------------------------------------------------------
// DEMO SERVICE — in-memory simulation for screenshots / dev without a wallet
// ---------------------------------------------------------------------------

class DemoAuctionService implements AuctionService {
  private auctions: AuctionView[] = seedAuctions();
  private events: AuctionEvent[] = seedEvents();
  private listeners = new Set<(e: AuctionEvent) => void>();
  private bgTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Simulate live background bidding every 12-20 seconds
    this.bgTimer = setInterval(() => this.maybeBackgroundBid(), 14000);
  }

  private maybeBackgroundBid(): void {
    const result = randomBackgroundEvent(this.auctions);
    if (!result) return;
    this.auctions = this.auctions.map((a) =>
      a.id === result.updated.id ? result.updated : a
    );
    this.events.unshift(result.event);
    if (this.events.length > 50) this.events.pop();
    this.listeners.forEach((cb) => cb(result.event));
  }

  private emit(event: AuctionEvent): void {
    this.events.unshift(event);
    if (this.events.length > 50) this.events.pop();
    this.listeners.forEach((cb) => cb(event));
  }

  async listActive(): Promise<AuctionView[]> {
    await delay(300);
    return this.auctions.filter((a) => !a.settled);
  }

  async listAll(): Promise<AuctionView[]> {
    await delay(300);
    return [...this.auctions];
  }

  async createAuction(
    params: CreateAuctionParams,
    seller: string,
    onStatus: (s: TxResult) => void
  ): Promise<TxResult> {
    onStatus({ status: "preparing" });
    await delay(500);
    onStatus({ status: "signing" });
    await delay(800);
    onStatus({ status: "submitting" });
    await delay(600);
    onStatus({ status: "pending", hash: randomTxHash() });
    await delay(1200);

    const newId = Math.max(...this.auctions.map((a) => a.id), 0) + 1;
    const now = Math.floor(Date.now() / 1000);
    const newAuction: AuctionView = {
      id: newId,
      auctionAddress: `CAUCTION…${randomTxHash().slice(0, 6).toUpperCase()}`,
      seller,
      itemName: params.itemName,
      startingPrice: Math.floor(params.startingPrice * 1e7),
      endTime: now + params.durationMinutes * 60,
      token: "CDASSET…USDC",
      settled: false,
      winner: null,
      finalPrice: 0,
      highestBidder: null,
      highestBid: 0,
      bidCount: 0,
    };
    this.auctions.push(newAuction);

    this.emit({
      id: `evt-${Date.now()}`,
      type: "auction_created",
      auctionId: newId,
      itemName: params.itemName,
      actor: seller,
      timestamp: now,
    });

    const result: TxResult = { status: "success", hash: randomTxHash() };
    onStatus(result);
    return result;
  }

  async placeBid(
    auctionId: number,
    amount: number,
    bidder: string,
    onStatus: (s: TxResult) => void
  ): Promise<TxResult> {
    onStatus({ status: "preparing" });
    await delay(400);
    onStatus({ status: "signing" });
    await delay(900);
    onStatus({ status: "submitting" });
    await delay(500);
    onStatus({ status: "pending", hash: randomTxHash() });
    await delay(1500);

    const stroops = Math.floor(amount * 1e7);
    this.auctions = this.auctions.map((a) =>
      a.id === auctionId
        ? { ...a, highestBidder: bidder, highestBid: stroops, bidCount: a.bidCount + 1 }
        : a
    );

    const auction = this.auctions.find((a) => a.id === auctionId);
    this.emit({
      id: `evt-${Date.now()}`,
      type: "bid_placed",
      auctionId,
      itemName: auction?.itemName ?? "Unknown",
      actor: bidder,
      amount: stroops,
      timestamp: Math.floor(Date.now() / 1000),
    });

    const result: TxResult = { status: "success", hash: randomTxHash() };
    onStatus(result);
    return result;
  }

  async settleAuction(
    auctionId: number,
    onStatus: (s: TxResult) => void
  ): Promise<TxResult> {
    onStatus({ status: "preparing" });
    await delay(500);
    onStatus({ status: "signing" });
    await delay(700);
    onStatus({ status: "submitting" });
    await delay(400);
    onStatus({ status: "pending", hash: randomTxHash() });
    await delay(1000);

    const auction = this.auctions.find((a) => a.id === auctionId);
    this.auctions = this.auctions.map((a) =>
      a.id === auctionId
        ? { ...a, settled: true, winner: a.highestBidder, finalPrice: a.highestBid }
        : a
    );

    if (auction) {
      this.emit({
        id: `evt-${Date.now()}`,
        type: "auction_settled",
        auctionId,
        itemName: auction.itemName,
        actor: auction.highestBidder ?? "—",
        amount: auction.highestBid,
        timestamp: Math.floor(Date.now() / 1000),
      });
    }

    const result: TxResult = { status: "success", hash: randomTxHash() };
    onStatus(result);
    return result;
  }

  subscribeEvents(cb: (e: AuctionEvent) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
}

// ---------------------------------------------------------------------------
// REAL SERVICE — wraps stellar-sdk Soroban RPC + stellar-wallets-kit
// ---------------------------------------------------------------------------

class RealAuctionService implements AuctionService {
  async listActive(): Promise<AuctionView[]> {
    // In real mode, call registry.list_active() via Soroban RPC
    // For now, return empty — will be wired when deploying to testnet
    return [];
  }

  async listAll(): Promise<AuctionView[]> {
    return [];
  }

  async createAuction(
    _params: CreateAuctionParams,
    _seller: string,
    onStatus: (s: TxResult) => void
  ): Promise<TxResult> {
    onStatus({ status: "failed", error: "Real mode not configured. Set VITE_REGISTRY_CONTRACT_ID." });
    return { status: "failed", error: "Not configured" };
  }

  async placeBid(
    _auctionId: number,
    _amount: number,
    _bidder: string,
    onStatus: (s: TxResult) => void
  ): Promise<TxResult> {
    onStatus({ status: "failed", error: "Real mode not configured." });
    return { status: "failed", error: "Not configured" };
  }

  async settleAuction(
    _auctionId: number,
    onStatus: (s: TxResult) => void
  ): Promise<TxResult> {
    onStatus({ status: "failed", error: "Real mode not configured." });
    return { status: "failed", error: "Not configured" };
  }

  subscribeEvents(_cb: (e: AuctionEvent) => void): () => void {
    return () => {};
  }
}

// ---------------------------------------------------------------------------
// Export singleton
// ---------------------------------------------------------------------------

export const service: AuctionService = DEMO_MODE
  ? new DemoAuctionService()
  : new RealAuctionService();

export function getStatusLabel(status: TxStatus): string {
  switch (status) {
    case "preparing": return "Preparing transaction…";
    case "signing": return "Waiting for wallet signature…";
    case "submitting": return "Submitting to network…";
    case "pending": return "Awaiting confirmation…";
    case "success": return "Transaction confirmed!";
    case "failed": return "Transaction failed";
    default: return "";
  }
}
