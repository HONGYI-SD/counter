#![allow(clippy::result_large_err)]

use anchor_lang::prelude::*;
use dd_merkle_tree::{MerkleTree, HashingAlgorithm};

declare_id!("6fXWMHeqiJNC8rwNom5d7GLNFrqsDKzWpzs7Ee6rVtmg");

#[program]
pub mod counter_anchor {
    use dd_merkle_tree::MerkleProof;

    use super::*;

    pub fn initialize_counter(ctx: Context<Initialize>) -> Result<()> {
        let tree = &mut ctx.accounts.merkle_tree;
        tree.merkle_root = [0; 32];
        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64, addr: Pubkey) -> Result<()> {
        let account_tree = &mut ctx.accounts.merkle_tree;

        // 1. recover the merkle tree
        let mut tree = MerkleTree::new(HashingAlgorithm::Sha256d, 32);
        let pre_leafs = account_tree.leaf_hashes.clone().into_iter().map(|arr| arr.to_vec()).collect();
        tree.add_hashes(pre_leafs).unwrap();
        
        // 2. add new leaf
        let leaf_hash = DepositInfo{addr: addr.clone(), amount}.double_hash();
        tree.add_hash(leaf_hash).unwrap();
        
        // 3. record new leaf and new tree root
        account_tree.leaf_hashes.push(DepositInfo{addr: addr.clone(), amount}.double_hash_array());
        tree.merklize().unwrap();
        let root = tree.get_merkle_root().unwrap();
        account_tree.merkle_root = root.try_into().map_err(|_| "Conversion failed").unwrap();
       
        // 4. emit event
        let index :u64 = account_tree.leaf_hashes.len().try_into().unwrap(); 
        emit!(DepositEvent{amount, addr, index});

        Ok(())
    }

    pub fn verify_merkle_proof(
        ctx: Context<Deposit>, 
        deposit_amount: u64,
        user_addr: Pubkey,
        proof_index: u32,
        proof_hashes: Vec<u8>,
     ) -> Result<()> {
        msg!("deposit_amount:{}", deposit_amount);
        msg!("user_addr: {:?}", user_addr);
        msg!("proof_index: {}", proof_index);
        msg!("proof_hashes: {:?}", proof_hashes);
        
        let accs_deposit = &mut ctx.accounts.merkle_tree;

        // recover the proof
        let proof = MerkleProof::new(HashingAlgorithm::Sha256d, 32, proof_index, proof_hashes);
        let leaf_hash = DepositInfo{addr: user_addr, amount: deposit_amount}.double_hash_array();
        let tmp_root = proof.merklize_hash(&leaf_hash).unwrap();

        // check proof root
        assert_eq!(32, tmp_root.len());
        let mut proof_root = [0u8; 32];
        proof_root.copy_from_slice(&tmp_root);
        assert_eq!(accs_deposit.merkle_root, proof_root);

        // todo mint spl token
        Ok(())

    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        init,
        space = 8 + MerkleTreeAccount::INIT_SPACE,
        payer = payer
    )]
    pub merkle_tree: Account<'info, MerkleTreeAccount>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub merkle_tree: Account<'info, MerkleTreeAccount>,
}

#[account]
#[derive(InitSpace)]
pub struct MerkleTreeAccount {
    merkle_root: [u8; 32],
    #[max_len(100)] // temprary solution
    leaf_hashes: Vec<[u8; 32]>,
}

#[event]
pub struct DepositEvent {
    pub amount: u64,
    pub addr: Pubkey,
    pub index: u64,
}

pub struct DepositInfo {
    addr: Pubkey,
    amount: u64,
}

impl DepositInfo {
    fn to_bytes(&self) -> Vec<u8> {
        let mut m = self.amount.to_le_bytes().to_vec();
        m.extend_from_slice(&self.addr.to_bytes());
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