#![cfg(test)]
use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    token, vec, Address, Env,
};

use crate::{ContractError, TokenLocker, TokenLockerClient, Vesting};

// ── Helpers ───────────────────────────────────────────────────────────────────

fn setup() -> (Env, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let contract = env.register(TokenLocker, ());
    (env, contract)
}

fn mock_token(env: &Env) -> (Address, token::StellarAssetClient) {
    let admin = Address::generate(env);
    let token_id = env.register_stellar_asset_contract(admin.clone());
    let client = token::StellarAssetClient::new(env, &token_id);
    (token_id, client)
}

fn set_ledger_time(env: &Env, timestamp: u64) {
    env.ledger().set(LedgerInfo {
        timestamp,
        protocol_version: 22,
        sequence_number: 100,
        network_id: Default::default(),
        base_reserve: 10,
        min_temp_entry_ttl: 10,
        min_persistent_entry_ttl: 10,
        max_entry_ttl: 10_000_000,
    });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[test]
fn create_lock_succeeds_with_valid_inputs() {
    let (env, contract) = setup();
    let client = TokenLockerClient::new(&env, &contract);

    let creator = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let (token_id, token_admin) = mock_token(&env);

    token_admin.mint(&creator, &1_000_0000000_i128);

    set_ledger_time(&env, 1_000_000);
    let unlock_at: u64 = 1_000_000 + 86_400;

    let lock_id = client
        .create_lock(&creator, &token_id, &100_0000000_i128, &beneficiary, &unlock_at, &None)
        .unwrap();

    let lock = client.get_lock(&lock_id).unwrap();
    assert_eq!(lock.amount, 100_0000000_i128);
    assert_eq!(lock.creator, creator);
    assert_eq!(lock.beneficiary, beneficiary);
    assert_eq!(lock.unlock_at, unlock_at);
    assert!(!lock.withdrawn);
}

#[test]
fn create_lock_rejects_zero_amount() {
    let (env, contract) = setup();
    let client = TokenLockerClient::new(&env, &contract);

    let creator = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let (token_id, _) = mock_token(&env);

    set_ledger_time(&env, 1_000_000);

    let result = client.try_create_lock(
        &creator,
        &token_id,
        &0_i128,
        &beneficiary,
        &(1_000_000 + 86_400),
        &None,
    );
    assert_eq!(result, Err(Ok(ContractError::AmountMustBePositive)));
}

#[test]
fn create_lock_rejects_past_unlock_date() {
    let (env, contract) = setup();
    let client = TokenLockerClient::new(&env, &contract);

    let creator = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let (token_id, _) = mock_token(&env);

    set_ledger_time(&env, 1_000_000);

    let result = client.try_create_lock(
        &creator,
        &token_id,
        &100_i128,
        &beneficiary,
        &999_999, // in the past
        &None,
    );
    assert_eq!(result, Err(Ok(ContractError::UnlockMustBeFuture)));
}

#[test]
fn extend_can_only_increase_unlock_date() {
    let (env, contract) = setup();
    let client = TokenLockerClient::new(&env, &contract);

    let creator = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let (token_id, token_admin) = mock_token(&env);

    token_admin.mint(&creator, &1_000_0000000_i128);

    set_ledger_time(&env, 1_000_000);
    let unlock_at: u64 = 1_100_000;

    let lock_id = client
        .create_lock(&creator, &token_id, &50_0000000_i128, &beneficiary, &unlock_at, &None)
        .unwrap();

    // Extending to same date must fail.
    let result = client.try_extend(&lock_id, &unlock_at);
    assert_eq!(result, Err(Ok(ContractError::CanOnlyExtend)));

    // Extending into the future must succeed.
    client.extend(&lock_id, &(unlock_at + 86_400)).unwrap();

    let lock = client.get_lock(&lock_id).unwrap();
    assert_eq!(lock.unlock_at, unlock_at + 86_400);
    assert_eq!(lock.extended_count, 1);
}

#[test]
fn withdraw_before_unlock_fails() {
    let (env, contract) = setup();
    let client = TokenLockerClient::new(&env, &contract);

    let creator = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let (token_id, token_admin) = mock_token(&env);

    token_admin.mint(&creator, &1_000_0000000_i128);

    set_ledger_time(&env, 1_000_000);
    let unlock_at: u64 = 1_100_000;

    let lock_id = client
        .create_lock(&creator, &token_id, &50_0000000_i128, &beneficiary, &unlock_at, &None)
        .unwrap();

    let result = client.try_withdraw(&lock_id);
    assert_eq!(result, Err(Ok(ContractError::StillLocked)));
}

#[test]
fn withdraw_after_unlock_succeeds() {
    let (env, contract) = setup();
    let client = TokenLockerClient::new(&env, &contract);

    let creator = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let (token_id, token_admin) = mock_token(&env);

    token_admin.mint(&creator, &1_000_0000000_i128);

    set_ledger_time(&env, 1_000_000);
    let unlock_at: u64 = 1_100_000;

    let lock_id = client
        .create_lock(&creator, &token_id, &50_0000000_i128, &beneficiary, &unlock_at, &None)
        .unwrap();

    set_ledger_time(&env, unlock_at + 1);
    client.withdraw(&lock_id).unwrap();

    let lock = client.get_lock(&lock_id).unwrap();
    assert!(lock.withdrawn);
}

#[test]
fn vesting_end_must_be_after_start() {
    let (env, contract) = setup();
    let client = TokenLockerClient::new(&env, &contract);

    let creator = Address::generate(&env);
    let beneficiary = Address::generate(&env);
    let (token_id, _) = mock_token(&env);

    set_ledger_time(&env, 1_000_000);

    let bad_vesting = Vesting { start: 2_000_000, end: 1_500_000, released: 0 };
    let result = client.try_create_lock(
        &creator,
        &token_id,
        &100_i128,
        &beneficiary,
        &(1_000_000 + 86_400),
        &Some(bad_vesting),
    );
    assert_eq!(result, Err(Ok(ContractError::VestingEndBeforeStart)));
}

#[test]
fn create_split_lock_requires_at_least_two_beneficiaries() {
    let (env, contract) = setup();
    let client = TokenLockerClient::new(&env, &contract);

    let creator = Address::generate(&env);
    let b1 = Address::generate(&env);
    let (token_id, token_admin) = mock_token(&env);
    token_admin.mint(&creator, &1_000_0000000_i128);

    set_ledger_time(&env, 1_000_000);

    let result = client.try_create_split_lock(
        &creator,
        &token_id,
        &100_0000000_i128,
        &vec![&env, (b1, 10_000_u64)],
        &(1_100_000_u64),
        &None,
    );
    assert_eq!(result, Err(Ok(ContractError::TooFewBeneficiaries)));
}

#[test]
fn create_split_lock_shares_must_sum_to_10000() {
    let (env, contract) = setup();
    let client = TokenLockerClient::new(&env, &contract);

    let creator = Address::generate(&env);
    let b1 = Address::generate(&env);
    let b2 = Address::generate(&env);
    let (token_id, token_admin) = mock_token(&env);
    token_admin.mint(&creator, &1_000_0000000_i128);

    set_ledger_time(&env, 1_000_000);

    let result = client.try_create_split_lock(
        &creator,
        &token_id,
        &100_0000000_i128,
        &vec![&env, (b1, 5_000_u64), (b2, 4_000_u64)], // sums to 9000 not 10000
        &(1_100_000_u64),
        &None,
    );
    assert_eq!(result, Err(Ok(ContractError::SharesMustSum10000)));
}

#[test]
fn create_split_lock_succeeds_and_allocates_correctly() {
    let (env, contract) = setup();
    let client = TokenLockerClient::new(&env, &contract);

    let creator = Address::generate(&env);
    let b1 = Address::generate(&env);
    let b2 = Address::generate(&env);
    let (token_id, token_admin) = mock_token(&env);
    token_admin.mint(&creator, &1_000_0000000_i128);

    set_ledger_time(&env, 1_000_000);
    let unlock_at: u64 = 1_100_000;

    let group_id = client
        .create_split_lock(
            &creator,
            &token_id,
            &1_000_0000000_i128,
            &vec![&env, (b1.clone(), 7_000_u64), (b2.clone(), 3_000_u64)],
            &unlock_at,
            &None,
        )
        .unwrap();

    let group = client.get_split_group(&group_id).unwrap();
    assert_eq!(group.lock_ids.len(), 2);

    let lock0 = client.get_lock(&group_id).unwrap();
    assert_eq!(lock0.amount, 700_0000000_i128); // 70%
    assert_eq!(lock0.beneficiary, b1);

    let lock1_id = group.lock_ids.get(1).unwrap();
    let lock1 = client.get_lock(&lock1_id).unwrap();
    assert_eq!(lock1.amount, 300_0000000_i128); // 30%
    assert_eq!(lock1.beneficiary, b2);
}
