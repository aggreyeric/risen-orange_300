#![cfg_attr(not(test), no_std)]

//! # Auction contract
//!
//! Per-auction logic for the Risen Auction House. Each auction is its own
//! contract instance, created by the [`registry`] contract.
//!
//! ## Lifecycle
//! 1. [`initialize`][AuctionTrait::initialize] — called once by the registry
//!    (cross-contract) to seed the auction's parameters.
//! 2. [`place_bid`][AuctionTrait::place_bid] — anyone may bid while the auction
//!    is open. The bid amount of the payment token is pulled from the bidder
//!    into this contract; the previously outbid bidder is refunded. Emits
//!    `BidPlaced`.
//! 3. [`settle`][AuctionTrait::settle] — callable after the end time. Pays the
//!    seller, emits `AuctionSettled`, then calls back into the registry via
//!    [`RegistryClient::register_settled`] (the inter-contract link).

use shared::{AuctionInitParams, AuctionState, AuctionTrait, BidInfo, RegistryClient};
use soroban_sdk::{
    contract, contractimpl, symbol_short, token::Client as TokenClient, Address, Env, Symbol,
};

#[contract]
pub struct AuctionContract;

const STATE_KEY: soroban_sdk::Symbol = symbol_short!("STATE");

fn read_state(env: &Env) -> Option<AuctionState> {
    env.storage().instance().get(&STATE_KEY)
}

fn require_state(env: &Env) -> AuctionState {
    read_state(env).expect("auction: not initialized")
}

fn save_state(env: &Env, state: &AuctionState) {
    env.storage().instance().set(&STATE_KEY, state);
}

#[contractimpl]
impl AuctionTrait for AuctionContract {
    fn initialize(env: Env, params: AuctionInitParams) {
        if read_state(&env).is_some() {
            panic!("auction: already initialized");
        }
        if params.starting_price <= 0 {
            panic!("auction: invalid starting price");
        }
        let state = AuctionState {
            auction_id: params.auction_id,
            registry: params.registry.clone(),
            seller: params.seller.clone(),
            item_name: params.item_name.clone(),
            starting_price: params.starting_price,
            end_time: params.end_time,
            token: params.token.clone(),
            highest_bidder: None,
            highest_bid: params.starting_price,
            bid_count: 0,
            settled: false,
            winner: None,
        };
        save_state(&env, &state);
        env.events().publish(
            (Symbol::new(&env, "AuctionInitialized"), state.auction_id),
            (state.seller.clone(), state.starting_price, state.end_time),
        );
    }

    fn place_bid(env: Env, bidder: Address, amount: i128) {
        bidder.require_auth();
        if amount <= 0 {
            panic!("auction: invalid amount");
        }
        let mut state = require_state(&env);
        if state.settled {
            panic!("auction: already settled");
        }
        if env.ledger().timestamp() >= state.end_time {
            panic!("auction: has ended");
        }
        if amount <= state.highest_bid {
            panic!("auction: bid too low");
        }

        let token = TokenClient::new(&env, &state.token);
        // Pull the new bid from the bidder into the auction contract.
        token.transfer(&bidder, &env.current_contract_address(), &amount);
        // Refund the previously outbid bidder, if any.
        if let Some(prev_bidder) = state.highest_bidder.clone() {
            token.transfer(&env.current_contract_address(), &prev_bidder, &state.highest_bid);
        }

        state.highest_bidder = Some(bidder.clone());
        state.highest_bid = amount;
        state.bid_count += 1;
        save_state(&env, &state);
        env.events().publish(
            (Symbol::new(&env, "BidPlaced"), state.auction_id),
            (bidder, amount, state.bid_count),
        );
    }

    fn highest_bid(env: Env) -> Option<BidInfo> {
        match read_state(&env) {
            Some(state) if state.bid_count > 0 => Some(BidInfo {
                bidder: state.highest_bidder,
                amount: state.highest_bid,
                bid_count: state.bid_count,
            }),
            _ => None,
        }
    }

    fn get_state(env: Env) -> AuctionState {
        require_state(&env)
    }

    fn settle(env: Env) {
        let mut state = require_state(&env);
        if state.settled {
            panic!("auction: already settled");
        }
        if env.ledger().timestamp() < state.end_time {
            panic!("auction: not ended yet");
        }

        let token = TokenClient::new(&env, &state.token);
        let winner = state.highest_bidder.clone();
        let final_price = if winner.is_some() {
            state.highest_bid
        } else {
            0
        };

        if let Some(w) = winner.clone() {
            // Pay the seller the winning bid.
            token.transfer(&env.current_contract_address(), &state.seller, &state.highest_bid);
            state.winner = Some(w);
        }

        state.settled = true;
        save_state(&env, &state);

        // Inter-contract communication: report settlement back to the registry.
        RegistryClient::new(&env, &state.registry)
            .register_settled(&state.auction_id, &state.winner, &final_price);

        env.events().publish(
            (Symbol::new(&env, "AuctionSettled"), state.auction_id),
            (state.winner.clone(), final_price),
        );
    }
}

#[cfg(test)]
mod test;
