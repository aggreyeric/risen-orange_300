#![cfg_attr(not(test), no_std)]

//! Shared types and cross-contract client traits for the Risen Auction House.
//!
//! This crate is intentionally a plain `rlib` dependency (not a contract wasm).
//! It holds the canonical types used by both the `registry` and `auction`
//! contracts, plus the client traits that make inter-contract communication
//! type-safe. Keeping the traits here avoids a circular dependency between the
//! two contract crates: `auction` only needs `RegistryClient` and `registry`
//! only needs `AuctionClient`, both sourced from `shared`.

use soroban_sdk::{contractclient, contracttype, Address, String, Vec};

/// Immutable bookkeeping record for an auction, stored by the registry.
#[contracttype]
#[derive(Clone, PartialEq, Eq)]
pub struct AuctionInfo {
    pub id: u32,
    pub auction_address: Address,
    pub seller: Address,
    pub item_name: String,
    pub starting_price: i128,
    pub end_time: u64,
    pub token: Address,
    pub settled: bool,
    pub winner: Option<Address>,
    pub final_price: i128,
}

/// Parameters passed from the registry into a freshly created auction contract
/// via the cross-contract `initialize` call.
#[contracttype]
#[derive(Clone, PartialEq, Eq)]
pub struct AuctionInitParams {
    pub registry: Address,
    pub auction_id: u32,
    pub seller: Address,
    pub item_name: String,
    pub starting_price: i128,
    pub end_time: u64,
    pub token: Address,
}

/// Live state of a single auction. Source of truth for bidding lives in the
/// `auction` contract; the registry stores a snapshot for listing purposes.
#[contracttype]
#[derive(Clone, PartialEq, Eq)]
pub struct AuctionState {
    pub auction_id: u32,
    pub registry: Address,
    pub seller: Address,
    pub item_name: String,
    pub starting_price: i128,
    pub end_time: u64,
    pub token: Address,
    pub highest_bidder: Option<Address>,
    pub highest_bid: i128,
    pub bid_count: u32,
    pub settled: bool,
    pub winner: Option<Address>,
}

// ---------------------------------------------------------------------------
// Registry trait + client
// ---------------------------------------------------------------------------

/// Trait implemented by the registry contract and consumed by the auction
/// contract (which calls `register_settled` when an auction settles).
///
/// Applying `#[contractclient]` here generates `RegistryClient`, the type-safe
/// cross-contract client used by the auction contract (and the frontend).
#[contractclient(name = "RegistryClient")]
pub trait RegistryTrait {
    /// One-time initialization: set the admin and the accepted payment token.
    fn initialize(env: soroban_sdk::Env, admin: Address, token: Address);

    /// Register a freshly-deployed auction instance. The registry initializes
    /// it via a cross-contract call and records it. Returns the auction id.
    fn create_auction(
        env: soroban_sdk::Env,
        auction_address: Address,
        seller: Address,
        item_name: String,
        starting_price: i128,
        duration_secs: u64,
    ) -> u32;

    /// List auctions that have not yet settled.
    fn list_active(env: soroban_sdk::Env) -> Vec<AuctionInfo>;

    /// List every auction ever created.
    fn list_all(env: soroban_sdk::Env) -> Vec<AuctionInfo>;

    /// Fetch a single auction by id. Panics if it does not exist.
    fn get_auction(env: soroban_sdk::Env, id: u32) -> AuctionInfo;

    /// Callback invoked by an auction contract once it has settled.
    fn register_settled(
        env: soroban_sdk::Env,
        id: u32,
        winner: Option<Address>,
        final_price: i128,
    );

    /// Total number of auctions created.
    fn auction_count(env: soroban_sdk::Env) -> u32;
}

// ---------------------------------------------------------------------------
// Auction trait + client
// ---------------------------------------------------------------------------

/// Compact read result for the current bid.
#[contracttype]
#[derive(Clone, PartialEq, Eq)]
pub struct BidInfo {
    pub bidder: Option<Address>,
    pub amount: i128,
    pub bid_count: u32,
}

/// Trait implemented by every auction contract instance.
///
/// Applying `#[contractclient]` here generates `AuctionClient`, the type-safe
/// cross-contract client used by the registry (and the frontend).
#[contractclient(name = "AuctionClient")]
pub trait AuctionTrait {
    /// Called once by the registry to seed the auction with its parameters.
    fn initialize(env: soroban_sdk::Env, params: AuctionInitParams);

    /// Place a bid. Pulls `amount` of the payment token from `bidder` into the
    /// contract and refunds the previously outbid bidder. Emits `BidPlaced`.
    fn place_bid(env: soroban_sdk::Env, bidder: Address, amount: i128);

    /// Read-only: current highest bidder / bid amount.
    fn highest_bid(env: soroban_sdk::Env) -> Option<BidInfo>;

    /// Read-only: full auction state.
    fn get_state(env: soroban_sdk::Env) -> AuctionState;

    /// Finalize the auction after its end time. Transfers funds to the seller,
    /// emits `AuctionSettled`, and notifies the registry via cross-contract call.
    fn settle(env: soroban_sdk::Env);
}
