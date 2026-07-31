/**
 * Frontend type mirrors of the Soroban contract types in `contracts/shared/src/lib.rs`.
 */

export type AddressString = string;

/** Mirrors `AuctionInfo` — immutable record stored by the registry. */
export interface AuctionInfo {
  id: number;
  auctionAddress: AddressString;
  seller: AddressString;
  itemName: string;
  startingPrice: number;
  endTime: number;       // epoch seconds
  token: AddressString;
  settled: boolean;
  winner: AddressString | null;
  finalPrice: number;
}

/** Mirrors `AuctionState` — live bidding state. */
export interface AuctionState {
  auctionId: number;
  registry: AddressString;
  seller: AddressString;
  itemName: string;
  startingPrice: number;
  endTime: number;
  token: AddressString;
  highestBidder: AddressString | null;
  highestBid: number;
  bidCount: number;
  settled: boolean;
  winner: AddressString | null;
}

/** Combined view for UI convenience. */
export interface AuctionView extends AuctionInfo {
  highestBidder: AddressString | null;
  highestBid: number;
  bidCount: number;
}

export interface CreateAuctionParams {
  itemName: string;
  startingPrice: number;
  durationMinutes: number;
}

export type TxStatus =
  | "idle"
  | "preparing"
  | "signing"
  | "submitting"
  | "pending"
  | "success"
  | "failed";

export interface TxResult {
  status: TxStatus;
  hash?: string;
  error?: string;
}

export type AuctionEventType =
  | "auction_created"
  | "bid_placed"
  | "auction_settled";

export interface AuctionEvent {
  id: string;
  type: AuctionEventType;
  auctionId: number;
  itemName: string;
  actor: AddressString;
  amount?: number;
  timestamp: number;
}

export interface WalletState {
  connected: boolean;
  address: AddressString | null;
}
