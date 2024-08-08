#![allow(clippy::result_large_err)]

use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_program;
use dd_merkle_tree::{MerkleTree, HashingAlgorithm};

declare_id!("VphJHWrFwGrV1omKJV627yx1ywU68M4TUbe5wA8SNYD");

const CHUNK_SIZE: usize = 10; // temp size, easy for test
const HASH_SIZE: usize = 32;

#[program]
pub mod counter_anchor {
    use dd_merkle_tree::MerkleProof;

    use super::*;

    pub fn initialize_counter(_ctx: Context<L2Initialize>) -> Result<()> {
        
        Ok(())
    }

    pub fn increase_l2_summary_account_space(
        _ctx: Context<IncreaseL2SummaryAccount>,
        len: u32
    ) -> Result<()> {
        msg!("increase_summary_account_space:{}", len);
        Ok(())
    }

    pub fn update_leafpda_merkle_root<'info>(
        ctx: Context<'_, '_, 'info, 'info, UpdataRoot<'info>>, 
        root: Vec<u8>,
        deposit_index: u64,
    ) -> Result<()> {
        let l2_summary = &mut ctx.accounts.l2_summary;
        let start = deposit_index as usize / CHUNK_SIZE;
        msg!("update root, start: {:?}, end: {:?}", start, start + HASH_SIZE);
        msg!("update root: {:?}", root);
        l2_summary.load_mut()?.merkle_roots_container[start..(start + HASH_SIZE)].copy_from_slice(&root);
        Ok(())
    }

    pub fn verify_merkle_proof(
        ctx: Context<UpdataRoot>, 
        deposit_amount: u64,
        deposit_index: u32,
        user_addr: Pubkey,
        proof_hashes: Vec<u8>,
     ) -> Result<()> {
        msg!("deposit_amount:{}", deposit_amount);
        msg!("user_addr: {:?}", user_addr);
        msg!("proof_hashes: {:?}", proof_hashes);
        
        let l2summary = &mut ctx.accounts.l2_summary;
        let start = deposit_index as usize / CHUNK_SIZE;
        let root_on_chain = &l2summary.load_mut()?.merkle_roots_container[start..(start + HASH_SIZE)];
        msg!("root on chain, start: {:?}, end: {:?}", start, start + HASH_SIZE);
        msg!("root on chain: {:?}", root_on_chain);

        // recover the proof
        let proof = MerkleProof::new(HashingAlgorithm::Sha256d, 32, deposit_index, proof_hashes);
        let leaf_hash = DepositInfo{user: user_addr, amount: deposit_amount}.double_hash_array();
        let tmp_root = proof.merklize_hash(&leaf_hash).unwrap();
        msg!("proof root: {:?}", tmp_root);

        //check proof root
        assert_eq!(32, tmp_root.len());
        let mut proof_root = [0u8; 32];
        proof_root.copy_from_slice(&tmp_root);
        assert_eq!(root_on_chain, proof_root);

        // todo mint spl token
        Ok(())

    }
}

#[derive(Accounts)]
pub struct L2Initialize<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        init,
        payer = payer,
        space = 10 * (1024 as usize),
    )]
    pub l2_summary: AccountLoader<'info, L2SummaryAccount>,
    pub system_program: Program<'info, System>,
}



#[derive(Accounts)]
pub struct UpdataRoot<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
    #[account(mut)]
    pub l2_summary: AccountLoader<'info, L2SummaryAccount>,
}

#[account(zero_copy(unsafe))]
#[repr(C)]
pub struct L2SummaryAccount {
    pub leaf_chunk_count: u64,
    pub leaf_count: u64,
    pub merkle_roots_container: [u8; 10240 * 10 - 8 - 8 - 8], // about 10KB
}

#[derive(Accounts)]
#[instruction(len: u32)]
pub struct IncreaseL2SummaryAccount<'info> {
    #[account(mut, 
        realloc = len as usize, 
        realloc::zero = true, 
        realloc::payer=signer)]
    pub l2_summary: AccountLoader<'info, L2SummaryAccount>,
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(address = system_program::ID)]
    pub system_program: Program<'info, System>,
}

#[event]
pub struct DepositEvent {
    pub amount: u64,
    pub user: Pubkey,
    pub deposit_index: u64,
    pub merkle_root: [u8; 32],
    pub leaf_account_pubkey: Pubkey,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Chunk is full.")]
    ChunkFull,
    #[msg("Leaf not found")]
    LeafNotFound,
}
pub struct DepositInfo {
    user: Pubkey,
    amount: u64,
}

impl DepositInfo {
    fn to_bytes(&self) -> Vec<u8> {
        let mut m = self.amount.to_le_bytes().to_vec();
        m.extend_from_slice(&self.user.to_bytes());
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
