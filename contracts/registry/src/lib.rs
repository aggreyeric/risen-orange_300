#![cfg_attr(not(test), no_std)]

//! # Registry contract
//!
//! The "core" contract of the Risen Auction House. It maintains the list of all
//! auctions and brokers their creation. When an auction is created, the registry
//! performs the cross-contract call that initializes it
//! ([`AuctionClient::initialize`]); when an auction settles, the auction
//! contract calls back into [`register_settled`][RegistryTrait::register_settled].
//!
//! This bidirectional inter-contract communication is the link required by the
//! Level 3 challenge.

use shared::{AuctionClient, AuctionInfo, AuctionInitParams, RegistryTrait};
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env, Map, String, Symbol, Vec};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Token,
    NextId,
    Auctions,
    AllIds,
}

#[contract]
pub struct AuctionRegistry;

fn get<T: soroban_sdk::TryFromVal<Env, soroban_sdk::Val> + soroban_sdk::TryIntoVal<Env, soroban_sdk::Val>>(
    env: &Env,
    key: &DataKey,
) -> Option<T> {
    env.storage().instance().get(key)
}

fn admin(env: &Env) -> Address {
    get::<Address>(env, &DataKey::Admin).expect("registry: not initialized")
}

fn token(env: &Env) -> Address {
    get::<Address>(env, &DataKey::Token).expect("registry: not initialized")
}

fn auctions(env: &Env) -> Map<u32, AuctionInfo> {
    get::<Map<u32, AuctionInfo>>(env, &DataKey::Auctions).unwrap_or_else(|| Map::new(env))
}

fn all_ids(env: &Env) -> Vec<u32> {
    get::<Vec<u32>>(env, &DataKey::AllIds).unwrap_or_else(|| Vec::new(env))
}

fn next_id(env: &Env) -> u32 {
    get::<u32>(env, &DataKey::NextId).unwrap_or(1)
}

#[contractimpl]
impl RegistryTrait for AuctionRegistry {
    fn initialize(env: Env, admin: Address, token: Address) {
        admin.require_auth();
        if get::<Address>(&env, &DataKey::Admin).is_some() {
            panic!("registry: already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::NextId, &1u32);
        env.storage().instance().set(&DataKey::Auctions, &Map::<u32, AuctionInfo>::new(&env));
        env.storage().instance().set(&DataKey::AllIds, &Vec::<u32>::new(&env));
        env.events()
            .publish((Symbol::new(&env, "RegistryInitialized"),), (admin, token));
    }

    fn create_auction(
        env: Env,
        auction_address: Address,
        seller: Address,
        item_name: String,
        starting_price: i128,
        duration_secs: u64,
    ) -> u32 {
        seller.require_auth();
        if starting_price <= 0 {
            panic!("registry: invalid starting price");
        }
        if get::<Address>(&env, &DataKey::Admin).is_none() {
            panic!("registry: not initialized");
        }

        let id = next_id(&env);
        let end_time = env.ledger().timestamp() + duration_secs;
        let tok = token(&env);

        // Inter-contract communication: initialize the new auction instance.
        AuctionClient::new(&env, &auction_address).initialize(&AuctionInitParams {
            registry: env.current_contract_address(),
            auction_id: id,
            seller: seller.clone(),
            item_name: item_name.clone(),
            starting_price,
            end_time,
            token: tok.clone(),
        });

        let info = AuctionInfo {
            id,
            auction_address: auction_address.clone(),
            seller: seller.clone(),
            item_name: item_name.clone(),
            starting_price,
            end_time,
            token: tok,
            settled: false,
            winner: None,
            final_price: 0,
        };

        let mut a = auctions(&env);
        a.set(id, info.clone());
        env.storage().instance().set(&DataKey::Auctions, &a);

        let mut ids = all_ids(&env);
        ids.push_back(id);
        env.storage().instance().set(&DataKey::AllIds, &ids);
        env.storage().instance().set(&DataKey::NextId, &(id + 1));

        env.events().publish(
            (Symbol::new(&env, "AuctionCreated"), id),
            (auction_address, seller, item_name),
        );
        id
    }

    fn list_active(env: Env) -> Vec<AuctionInfo> {
        let a = auctions(&env);
        let mut out: Vec<AuctionInfo> = Vec::new(&env);
        for info in a.values().iter() {
            if !info.settled {
                out.push_back(info);
            }
        }
        out
    }

    fn list_all(env: Env) -> Vec<AuctionInfo> {
        let a = auctions(&env);
        let mut out: Vec<AuctionInfo> = Vec::new(&env);
        for info in a.values().iter() {
            out.push_back(info);
        }
        out
    }

    fn get_auction(env: Env, id: u32) -> AuctionInfo {
        let a = auctions(&env);
        a.get(id)
            .unwrap_or_else(|| panic!("registry: auction {id} not found"))
    }

    fn register_settled(env: Env, id: u32, winner: Option<Address>, final_price: i128) {
        let mut a = auctions(&env);
        let mut info = a
            .get(id)
            .unwrap_or_else(|| panic!("registry: auction {id} not found"));
        // Only the auction contract itself may report its own settlement.
        info.auction_address.require_auth();

        info.settled = true;
        info.winner = winner.clone();
        info.final_price = final_price;
        a.set(id, info.clone());
        env.storage().instance().set(&DataKey::Auctions, &a);
        env.events()
            .publish((Symbol::new(&env, "AuctionSettledRegistry"), id), (winner, final_price));
    }

    fn auction_count(env: Env) -> u32 {
        all_ids(&env).len() as u32
    }
}

// Keep the symbol short name referenced for clarity / potential future keys.
const _ADMIN_SHORT: soroban_sdk::Symbol = symbol_short!("ADMIN");
