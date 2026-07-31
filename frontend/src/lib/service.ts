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

// ===========================================================================
// REAL SERVICE — live Soroban RPC + Freighter wallet signing
// ===========================================================================

import * as StellarSdk from "@stellar/stellar-sdk";
import {
  RPC_URL,
  NETWORK_PASSPHRASE,
  REGISTRY_CONTRACT_ID,
  READ_SOURCE_PUBKEY,
  POLL_INTERVAL_MS,
} from "./config";

class RealAuctionService implements AuctionService {
  private server: StellarSdk.rpc.Server;
  private registryContract: StellarSdk.Contract;
  private cachedReadAccount: StellarSdk.Account | null = null;
  private eventListeners = new Set<(e: AuctionEvent) => void>();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private lastEventLedger = 0;

  constructor() {
    this.server = new StellarSdk.rpc.Server(RPC_URL, { allowHttp: false });
    this.registryContract = new StellarSdk.Contract(REGISTRY_CONTRACT_ID);
    // Initialise event cursor to latest ledger so we only see new events
    this.server.getLatestLedger().then((ledger) => {
      this.lastEventLedger = Math.max(1, ledger.sequence - 100);
    }).catch(() => {});
    this.pollTimer = setInterval(() => this.pollEvents(), POLL_INTERVAL_MS);
  }

  private async readAccount(): Promise<StellarSdk.Account> {
    if (this.cachedReadAccount) {
      // Refresh sequence number
      this.cachedReadAccount = await this.server.getAccount(this.cachedReadAccount.accountId());
    }
    if (!this.cachedReadAccount) {
      this.cachedReadAccount = await this.server.getAccount(READ_SOURCE_PUBKEY);
    }
    return this.cachedReadAccount;
  }

  /** Run a read-only contract method via simulateTransaction (no signing needed). */
  private async simulateCall(
    contract: StellarSdk.Contract,
    method: string,
    ...args: StellarSdk.xdr.ScVal[]
  ): Promise<any> {
    const account = await this.readAccount();
    const tx = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call(method, ...args))
      .setTimeout(30)
      .build();

    const sim = await this.server.simulateTransaction(tx);
    if (!StellarSdk.rpc.Api.isSimulationSuccess(sim) || !sim.result?.retval) {
      throw new Error(`Simulation failed for ${method}`);
    }
    return StellarSdk.scValToNative(sim.result.retval);
  }

  /** Convert Soroban AuctionInfo + AuctionState maps into our frontend type. */
  private toAuctionView(info: Record<string, any>, state?: Record<string, any> | null): AuctionView {
    const num = (v: unknown): number => {
      if (typeof v === "bigint") return Number(v);
      if (typeof v === "string") return Number(v);
      if (typeof v === "number") return v;
      return 0;
    };
    const optAddr = (v: unknown): string | null =>
      v && v !== undefined ? String(v) : null;

    return {
      id: num(info.id),
      auctionAddress: String(info.auction_address),
      seller: String(info.seller),
      itemName: String(info.item_name),
      startingPrice: num(info.starting_price),
      endTime: num(info.end_time),
      token: String(info.token),
      settled: Boolean(info.settled),
      winner: optAddr(info.winner),
      finalPrice: num(info.final_price),
      // From live auction state (if fetched), otherwise defaults
      highestBidder: state ? optAddr(state.highest_bidder) : null,
      highestBid: state ? num(state.highest_bid) : num(info.starting_price),
      bidCount: state ? num(state.bid_count) : 0,
    };
  }

  async listAll(): Promise<AuctionView[]> {
    const rawList = await this.simulateCall(this.registryContract, "list_all");
    if (!Array.isArray(rawList) || rawList.length === 0) return [];

    // Fetch live auction state for each (highest bid, bidder, count)
    const views = await Promise.all(
      rawList.map(async (info: Record<string, any>) => {
        try {
          const auctionContract = new StellarSdk.Contract(String(info.auction_address));
          const state = await this.simulateCall(auctionContract, "get_state");
          return this.toAuctionView(info, state);
        } catch {
          return this.toAuctionView(info);
        }
      })
    );
    return views;
  }

  async listActive(): Promise<AuctionView[]> {
    const all = await this.listAll();
    return all.filter((a) => !a.settled);
  }

  /**
   * Prepare + sign + submit a write transaction via Freighter.
   * `buildTx` receives the source account and must return a built transaction.
   */
  private async signAndSubmit(
    sourcePubkey: string,
    buildTx: (account: StellarSdk.Account) => StellarSdk.Transaction,
    onStatus: (s: TxResult) => void
  ): Promise<TxResult> {
    const freighter = (window as any).freighterApi;
    if (!freighter) {
      onStatus({ status: "failed", error: "Freighter wallet not found" });
      return { status: "failed", error: "Freighter not found" };
    }

    try {
      onStatus({ status: "preparing" });
      const account = await this.server.getAccount(sourcePubkey);
      const tx = buildTx(account);

      onStatus({ status: "signing" });
      const signedXdr = await freighter.signTransaction(
        tx.toXDR(),
        { networkPassphrase: NETWORK_PASSPHRASE }
      );
      const signedTx = StellarSdk.TransactionBuilder.fromXDR(
        signedXdr,
        NETWORK_PASSPHRASE
      );

      onStatus({ status: "submitting" });
      const sendResponse = await this.server.sendTransaction(signedTx);

      if (sendResponse.status === "ERROR") {
        throw new Error(`Send failed: ${JSON.stringify(sendResponse.errorResult)}`);
      }

      onStatus({ status: "pending", hash: sendResponse.hash });

      // Poll for confirmation
      let confirmed = false;
      for (let i = 0; i < 30; i++) {
        await delay(3000);
        const resp = await this.server.getTransaction(sendResponse.hash);
        if (resp.status === "SUCCESS") {
          confirmed = true;
          break;
        }
        if (resp.status === "FAILED") {
          throw new Error(`Transaction failed on-chain`);
        }
      }

      if (!confirmed) {
        onStatus({ status: "failed", error: "Timed out waiting for confirmation" });
        return { status: "failed", error: "Timeout" };
      }

      const result: TxResult = { status: "success", hash: sendResponse.hash };
      onStatus(result);
      return result;
    } catch (err: any) {
      const result: TxResult = {
        status: "failed",
        error: err.message ?? "Unknown error",
      };
      onStatus(result);
      return result;
    }
  }

  async createAuction(
    params: CreateAuctionParams,
    seller: string,
    onStatus: (s: TxResult) => void
  ): Promise<TxResult> {
    // In a full implementation, this would:
    // 1. Deploy a new auction contract instance from WASM
    // 2. Call registry.create_auction with the new address
    // For the challenge demo, we use the already-deployed auctions.
    // The create flow is documented in the README.
    return this.signAndSubmit(
      seller,
      (account) =>
        new StellarSdk.TransactionBuilder(account, {
          fee: StellarSdk.BASE_FEE,
          networkPassphrase: NETWORK_PASSPHRASE,
        })
          .addOperation(
            this.registryContract.call(
              "create_auction",
              StellarSdk.nativeToScVal(params.itemName, { type: "string" }),
              StellarSdk.nativeToScVal(Math.floor(params.startingPrice * 1e7), { type: "i128" }),
              StellarSdk.nativeToScVal(params.durationMinutes * 60, { type: "u64" })
            )
          )
          .setTimeout(30)
          .build(),
      onStatus
    );
  }

  async placeBid(
    auctionId: number,
    amount: number,
    bidder: string,
    onStatus: (s: TxResult) => void
  ): Promise<TxResult> {
    // Look up the auction's contract address from the registry
    const all = await this.listAll();
    const auction = all.find((a) => a.id === auctionId);
    if (!auction) {
      onStatus({ status: "failed", error: "Auction not found" });
      return { status: "failed", error: "Not found" };
    }

    const auctionContract = new StellarSdk.Contract(auction.auctionAddress);
    const stroops = Math.floor(amount * 1e7);

    return this.signAndSubmit(
      bidder,
      (account) =>
        new StellarSdk.TransactionBuilder(account, {
          fee: StellarSdk.BASE_FEE,
          networkPassphrase: NETWORK_PASSPHRASE,
        })
          .addOperation(
            auctionContract.call(
              "place_bid",
              StellarSdk.nativeToScVal(bidder, { type: "address" }),
              StellarSdk.nativeToScVal(stroops, { type: "i128" })
            )
          )
          .setTimeout(30)
          .build(),
      onStatus
    );
  }

  async settleAuction(
    auctionId: number,
    onStatus: (s: TxResult) => void
  ): Promise<TxResult> {
    const all = await this.listAll();
    const auction = all.find((a) => a.id === auctionId);
    if (!auction) {
      onStatus({ status: "failed", error: "Auction not found" });
      return { status: "failed", error: "Not found" };
    }

    // Settle needs the seller (or anyone) to call it
    const freighter = (window as any).freighterApi;
    const caller = await freighter?.getPublicKey().catch(() => READ_SOURCE_PUBKEY);
    const auctionContract = new StellarSdk.Contract(auction.auctionAddress);

    return this.signAndSubmit(
      caller ?? READ_SOURCE_PUBKEY,
      (account) =>
        new StellarSdk.TransactionBuilder(account, {
          fee: StellarSdk.BASE_FEE,
          networkPassphrase: NETWORK_PASSPHRASE,
        })
          .addOperation(auctionContract.call("settle"))
          .setTimeout(30)
          .build(),
      onStatus
    );
  }

  /** Poll Soroban events for bid/auction activity. */
  private async pollEvents(): Promise<void> {
    if (this.eventListeners.size === 0) return;
    try {
      const resp = await this.server.getEvents({
        startLedger: this.lastEventLedger || undefined,
        filters: [
          {
            type: "contract",
            contractIds: [REGISTRY_CONTRACT_ID],
          },
        ],
        limit: 10,
      });

      for (const ev of resp.events) {
        if (ev.ledger <= this.lastEventLedger) continue;
        this.lastEventLedger = ev.ledger;
        const auctionEvent = this.parseEvent(ev);
        if (auctionEvent) {
          this.eventListeners.forEach((cb) => cb(auctionEvent));
        }
      }
    } catch (err) {
      // Silent fail — event polling is best-effort
    }
  }

  private parseEvent(ev: any): AuctionEvent | null {
    const topic = ev.topic?.[0]?.symbol ?? "";
    let type: AuctionEvent["type"] | null = null;
    if (topic === "AuctionCreated") type = "auction_created";
    else if (topic === "BidPlaced") type = "bid_placed";
    else if (topic === "AuctionSettled") type = "auction_settled";
    if (!type) return null;

    return {
      id: ev.id,
      type,
      auctionId: Number(ev.value?.auction_id ?? 0),
      itemName: String(ev.value?.item_name ?? ""),
      actor: String(ev.value?.seller ?? ev.value?.bidder ?? ""),
      amount: Number(ev.value?.amount ?? ev.value?.final_price ?? 0),
      timestamp: Math.floor(Date.now() / 1000),
    };
  }

  subscribeEvents(cb: (e: AuctionEvent) => void): () => void {
    this.eventListeners.add(cb);
    return () => this.eventListeners.delete(cb);
  }
}

// ===========================================================================
// DEMO SERVICE — in-memory simulation
// ===========================================================================

class DemoAuctionService implements AuctionService {
  private auctions: AuctionView[] = seedAuctions();
  private events: AuctionEvent[] = seedEvents();
  private listeners = new Set<(e: AuctionEvent) => void>();

  constructor() {
    setInterval(() => this.maybeBackgroundBid(), 14000);
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

// ===========================================================================
// Export singleton
// ===========================================================================

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
