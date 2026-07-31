//! Unit tests for the auction contract in isolation (bidding logic, refunds,
//! settlement guards). Settlement itself is tested in the registry crate's
//! integration tests because it performs a cross-contract callback.
//!
//! Generated cross-contract clients return their value directly and panic when
//! the contract traps. The `try_<fn>` variants return `Result<_, InvokeError>`
//! which we use to assert rejections.

use crate::AuctionContract;
use shared::{AuctionClient, AuctionInitParams};
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::{Client as TokenClient, StellarAssetClient},
    Address, Env, String as SdkString,
};

struct Fixture {
    env: Env,
    auction: Address,
    token: Address,
    seller: Address,
    bidder1: Address,
    bidder2: Address,
    end_time: u64,
}

const STARTING: i128 = 1_000_0000000; // 1,000.0000000 units (7 decimals mock)
const MINT: i128 = 30_000_0000000;

fn make_fixture(duration: u64) -> Fixture {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let token = env.register_stellar_asset_contract(admin);
    let sac = StellarAssetClient::new(&env, &token);

    let seller = Address::generate(&env);
    let bidder1 = Address::generate(&env);
    let bidder2 = Address::generate(&env);
    sac.mint(&bidder1, &MINT);
    sac.mint(&bidder2, &MINT);

    let auction = env.register_contract(None, AuctionContract);
    let end_time = env.ledger().timestamp() + duration;
    AuctionClient::new(&env, &auction).initialize(&AuctionInitParams {
        registry: Address::generate(&env),
        auction_id: 1,
        seller: seller.clone(),
        item_name: SdkString::from_str(&env, "Legendary Sword"),
        starting_price: STARTING,
        end_time,
        token: token.clone(),
    });

    Fixture {
        env,
        auction,
        token,
        seller,
        bidder1,
        bidder2,
        end_time,
    }
}

fn bal(env: &Env, token: &Address, who: &Address) -> i128 {
    TokenClient::new(env, token).balance(who)
}

#[test]
fn test_initialize_sets_state() {
    let f = make_fixture(600);
    let state = AuctionClient::new(&f.env, &f.auction).get_state();
    assert_eq!(state.starting_price, STARTING);
    assert_eq!(state.end_time, f.end_time);
    assert_eq!(state.bid_count, 0);
    assert!(!state.settled);
    assert_eq!(state.highest_bid, STARTING); // floor
    assert!(state.highest_bidder.is_none());
}

#[test]
fn test_bidding_and_outbid_refund() {
    let f = make_fixture(600);
    let client = AuctionClient::new(&f.env, &f.auction);

    // Bidder 1 opens bidding above the starting price.
    client.place_bid(&f.bidder1, &15_000_0000000);
    let hb = client.highest_bid().unwrap();
    assert_eq!(hb.amount, 15_000_0000000);
    assert_eq!(hb.bid_count, 1);
    assert_eq!(bal(&f.env, &f.token, &f.bidder1), MINT - 15_000_0000000);
    assert_eq!(bal(&f.env, &f.token, &f.auction), 15_000_0000000);

    // Bidder 2 outbids; bidder 1 must be refunded in full.
    client.place_bid(&f.bidder2, &20_000_0000000);
    let hb2 = client.highest_bid().unwrap();
    assert_eq!(hb2.amount, 20_000_0000000);
    assert_eq!(hb2.bid_count, 2);
    assert_eq!(bal(&f.env, &f.token, &f.bidder1), MINT); // refunded
    assert_eq!(bal(&f.env, &f.token, &f.bidder2), MINT - 20_000_0000000);
    assert_eq!(bal(&f.env, &f.token, &f.auction), 20_000_0000000);
}

#[test]
fn test_reject_bid_at_or_below_current_highest() {
    let f = make_fixture(600);
    let client = AuctionClient::new(&f.env, &f.auction);

    // First bid equal to the starting floor must be rejected (must be strictly
    // greater).
    assert!(
        client.try_place_bid(&f.bidder1, &STARTING).is_err(),
        "bid equal to floor should be rejected"
    );

    // A valid first bid, then a bid below the new highest must be rejected.
    client.place_bid(&f.bidder1, &15_000_0000000);
    assert!(
        client.try_place_bid(&f.bidder2, &12_000_0000000).is_err(),
        "bid below highest should be rejected"
    );
}

#[test]
fn test_reject_bidding_after_end_time() {
    let f = make_fixture(600);
    let client = AuctionClient::new(&f.env, &f.auction);

    // Fast-forward past the end time.
    f.env.ledger().with_mut(|l| l.timestamp = f.end_time + 1);

    assert!(
        client.try_place_bid(&f.bidder1, &15_000_0000000).is_err(),
        "bidding after end time should be rejected"
    );
}
