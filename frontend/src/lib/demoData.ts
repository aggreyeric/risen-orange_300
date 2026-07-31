import type { AuctionView, AuctionEvent } from "../types";
import { isEnded } from "./format";

const NOW = () => Math.floor(Date.now() / 1000);

const SEED_BIDDERS = [
  "GARXV…VK7Q2",
  "GD5PL…AB3WM",
  "GB2YR…9XKLP",
  "GC7TQ…4MZNE",
  "GA9BK…7HFDC",
];

let _id = 0;
function nid(prefix: string): string {
  _id += 1;
  return `${prefix}-${_id}`;
}

/** Seed auctions with varied states — some with bids, one ending soon, one settled. */
export function seedAuctions(): AuctionView[] {
  const now = NOW();
  return [
    {
      id: 1,
      auctionAddress: "CAUCTION…7YK3NB",
      seller: "GA1SELL…8MP5QZ",
      itemName: "Cosmic Genesis NFT #042",
      startingPrice: 50_0000000,
      endTime: now + 3600 * 2 + 1200,
      token: "CDASSET…USDC",
      settled: false,
      winner: null,
      finalPrice: 0,
      highestBidder: "GARXV…VK7Q2",
      highestBid: 85_0000000,
      bidCount: 7,
    },
    {
      id: 2,
      auctionAddress: "CB…H9PM2K",
      seller: "GA1SELL…8MP5QZ",
      itemName: "Rare Stellar Pixel — Obsidian",
      startingPrice: 20_0000000,
      endTime: now + 240,
      token: "CDASSET…USDC",
      settled: false,
      winner: null,
      finalPrice: 0,
      highestBidder: "GD5PL…AB3WM",
      highestBid: 37_5000000,
      bidCount: 12,
    },
    {
      id: 3,
      auctionAddress: "CC…R5WQ8M",
      seller: "GA2SELL…3KL9NB",
      itemName: "Genesis Validator Badge",
      startingPrice: 100_0000000,
      endTime: now + 3600 * 6,
      token: "CDASSET…USDC",
      settled: false,
      winner: null,
      finalPrice: 0,
      highestBidder: "GB2YR…9XKLP",
      highestBid: 120_0000000,
      bidCount: 3,
    },
    {
      id: 4,
      auctionAddress: "CD…T8YP3L",
      seller: "GA2SELL…3KL9NB",
      itemName: "Lumina — 1-of-1 Art Piece",
      startingPrice: 200_0000000,
      endTime: now + 3600 * 12,
      token: "CDASSET…USDC",
      settled: false,
      winner: null,
      finalPrice: 0,
      highestBidder: null,
      highestBid: 0,
      bidCount: 0,
    },
    {
      id: 5,
      auctionAddress: "CE…M2KQ9R",
      seller: "GA3SELL…7PR2WX",
      itemName: "Soroban Pioneer Certificate",
      startingPrice: 10_0000000,
      endTime: now - 1800,
      token: "CDASSET…USDC",
      settled: true,
      winner: "GC7TQ…4MZNE",
      finalPrice: 42_0000000,
      highestBidder: "GC7TQ…4MZNE",
      highestBid: 42_0000000,
      bidCount: 8,
    },
  ];
}

export function seedEvents(): AuctionEvent[] {
  const now = NOW();
  return [
    { id: nid("evt"), type: "auction_settled", auctionId: 5, itemName: "Soroban Pioneer Certificate", actor: "GC7TQ…4MZNE", amount: 42_0000000, timestamp: now - 1800 },
    { id: nid("evt"), type: "bid_placed", auctionId: 2, itemName: "Rare Stellar Pixel — Obsidian", actor: "GD5PL…AB3WM", amount: 37_5000000, timestamp: now - 90 },
    { id: nid("evt"), type: "bid_placed", auctionId: 1, itemName: "Cosmic Genesis NFT #042", actor: "GARXV…VK7Q2", amount: 85_0000000, timestamp: now - 300 },
    { id: nid("evt"), type: "auction_created", auctionId: 4, itemName: "Lumina — 1-of-1 Art Piece", actor: "GA2SELL…3KL9NB", timestamp: now - 600 },
    { id: nid("evt"), type: "bid_placed", auctionId: 3, itemName: "Genesis Validator Badge", actor: "GB2YR…9XKLP", amount: 120_0000000, timestamp: now - 900 },
    { id: nid("evt"), type: "auction_created", auctionId: 3, itemName: "Genesis Validator Badge", actor: "GA2SELL…3KL9NB", timestamp: now - 1200 },
  ];
}

/** A random background bidder places a bid on a random active auction. */
export function randomBackgroundEvent(auctions: AuctionView[]): { event: AuctionEvent; updated: AuctionView } | null {
  const active = auctions.filter((a) => !a.settled && !isEnded(a.endTime));
  if (active.length === 0) return null;
  const target = active[Math.floor(Math.random() * active.length)];
  const bidder = SEED_BIDDERS[Math.floor(Math.random() * SEED_BIDDERS.length)];
  const increment = Math.max(1_0000000, Math.floor(target.highestBid * 0.05));
  const newBid = (target.highestBid || target.startingPrice) + increment;
  const updated: AuctionView = {
    ...target,
    highestBidder: bidder,
    highestBid: newBid,
    bidCount: target.bidCount + 1,
  };
  const event: AuctionEvent = {
    id: nid("evt"),
    type: "bid_placed",
    auctionId: target.id,
    itemName: target.itemName,
    actor: bidder,
    amount: newBid,
    timestamp: NOW(),
  };
  return { event, updated };
}

export function randomTxHash(): string {
  const chars = "0123456789abcdef";
  let h = "";
  for (let i = 0; i < 64; i++) h += chars[Math.floor(Math.random() * 16)];
  return h;
}
