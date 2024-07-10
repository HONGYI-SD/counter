#![allow(clippy::result_large_err)]

use anchor_lang::prelude::*;
use dd_merkle_tree::{MerkleTree, HashingAlgorithm};

declare_id!("eFQ4aiydTUuhmEYKe4C4jwa1UGGFCUdi2JhrqA3gWy2");

#[program]
pub mod counter_anchor {
    use super::*;

    pub fn initialize_counter(_ctx: Context<InitializeCounter>) -> Result<()> {
        Ok(())
    }

    pub fn increment(ctx: Context<Increment>) -> Result<()> {
        ctx.accounts.counter.count = ctx.accounts.counter.count.checked_add(1).unwrap();
        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64, addr: String) -> Result<()> {
        let accs_deposit = &mut ctx.accounts.accs_deposit;
        // 1. recover the merkle tree
        let mut tree = MerkleTree::new(HashingAlgorithm::Sha256d, 32);
        let pre_leafs = accs_deposit.leaf_hashes.clone().into_iter().map(|arr| arr.to_vec()).collect();
        tree.add_hashes(pre_leafs).unwrap();
        // 2. add new leaf
        let leaf_hash = DepositInfo{addr: addr.clone(), amount}.double_hash();
        tree.add_hash(leaf_hash).unwrap();
        // 3. record new leaf and new tree root
        accs_deposit.leaf_hashes.push(DepositInfo{addr, amount}.double_hash_array());
        tree.merklize().unwrap();
        let root = tree.get_merkle_root().unwrap();
        accs_deposit.merkle_root = root.try_into().map_err(|_| "Conversion failed").unwrap();
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeCounter<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        init,
        space = 8 + Counter::INIT_SPACE,
        payer = payer
    )]
    pub counter: Account<'info, Counter>,
    #[account(
        init,
        space = 8 + acc_deposit::INIT_SPACE,
        payer = payer
    )]
    pub counter2: Account<'info, acc_deposit>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Increment<'info> {
    #[account(mut)]
    pub counter: Account<'info, Counter>,
}

#[account]
#[derive(InitSpace)]
pub struct Counter {
    count: u64,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub accs_deposit: Account<'info, acc_deposit>,
}

#[account]
#[derive(InitSpace)]
pub struct acc_deposit {
    merkle_root: [u8; 32],
    #[max_len(100)]
    leaf_hashes: Vec<[u8; 32]>,
}

pub struct DepositInfo {
    addr: String,
    amount: u64,
}

impl DepositInfo {
    fn to_bytes(&self) -> Vec<u8> {
        let mut m = self.amount.to_le_bytes().to_vec();
        m.extend_from_slice(self.addr.as_bytes());
        m
    }

    pub fn double_hash(&self) -> Vec<u8> {
        let m = &self.to_bytes();
        HashingAlgorithm::Sha256d.double_hash(m, 32 as usize)
    }

    pub fn double_hash_array(&self) -> [u8; 32] {
        let m = self.double_hash();
        assert!(m.len() == 32);
        let mut array = [0u8; 32];
        array.copy_from_slice(&m);
        array
    }
}