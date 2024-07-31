#![allow(clippy::result_large_err)]

use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_program;
use dd_merkle_tree::{MerkleTree, HashingAlgorithm};

declare_id!("5UiKzjUD4QczfzqenzDoEgawiGeKpgsMAgt1Uskbu7hb");

const CHUNK_SIZE: usize = 100; // temp size, easy to test

#[program]
pub mod counter_anchor {
    use dd_merkle_tree::MerkleProof;

    use super::*;

    pub fn initialize_counter(ctx: Context<Initialize>) -> Result<()> {
        let summary = &mut ctx.accounts.summary;
        summary.leaf_chunk_count = 0u64;
        summary.leaf_count = 0u64;
        Ok(())
    }

    pub fn increase_summary_account_space(
        _ctx: Context<IncreaseSummaryAccount>,
        _len: u32
    ) -> Result<()> {
        Ok(())
    }

    pub fn view<'info>(ctx: Context<'_, '_, 'info, 'info, Deposit<'info>>, _amount: u64, _addr: Pubkey) -> Result<()> {
        let leaf_account_info = ctx.remaining_accounts.get(0).unwrap();
        let leaf_account_data: Account<LeafChunkAccount> = Account::try_from(leaf_account_info)?;
        msg!("leaf hashes: {:?}", leaf_account_data.leaf_hashes);
        Ok(())
    }

    pub fn deposit<'info>(ctx: Context<'_, '_, 'info, 'info, Deposit<'info>>, amount: u64, addr: Pubkey) -> Result<()> {
        let summary = &mut ctx.accounts.summary;
        let chunk_count = summary.leaf_chunk_count;
        let leaf_account = &mut ctx.accounts.leaf;
        
        if leaf_account.leaf_hashes.len() >= CHUNK_SIZE {
            return Err(ErrorCode::ChunkFull.into());
        }

        let leaf_hash = DepositInfo{addr: addr.clone(), amount}.double_hash_array();
        leaf_account.leaf_hashes.push(leaf_hash);
        if leaf_account.leaf_hashes.len() == CHUNK_SIZE {
            summary.leaf_chunk_count += 1;
        }

        let mut tree = MerkleTree::new(HashingAlgorithm::Sha256d, 32);
        // load pre pda leaf_hashes
        if chunk_count  > 0 {
            let leaf_pda_accounts: Vec<Account<LeafChunkAccount>> = ctx
            .remaining_accounts
            .iter()
            .take(chunk_count as usize)
            .map(|acc| Account::try_from(acc).unwrap())
            .collect();

            for (_i, leaf_chunk_account_item) in leaf_pda_accounts.iter().enumerate() {
                // msg!("index: {}, leaf_hashes: {:?}", i, leaf_chunk_account_item.leaf_hashes.clone());
                tree.add_hashes(<Vec<[u8; 32]> as Clone>::clone(&leaf_chunk_account_item.leaf_hashes).into_iter().map(|arr| arr.to_vec()).collect()).unwrap();
            }
        }
        // load current pda leaf_hashes
        let leaf_count: u64 = chunk_count * CHUNK_SIZE as u64 + leaf_account.leaf_hashes.len() as u64 - 1 ;

        
        tree.add_hashes(<Vec<[u8; 32]> as Clone>::clone(&leaf_account.leaf_hashes).into_iter().map(|arr| arr.to_vec()).collect()).unwrap();

        tree.merklize().unwrap();
        let root = tree.get_merkle_root().unwrap();
        //summary.merkle_root = root.try_into().map_err(|_| "Conversion failed").unwrap();
        summary.leaf_count = leaf_count;
       
        emit!(DepositEvent{amount, addr, leaf_count});

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
        
        let accs_deposit = &mut ctx.accounts.summary;

        // recover the proof
        let proof = MerkleProof::new(HashingAlgorithm::Sha256d, 32, proof_index, proof_hashes);
        let leaf_hash = DepositInfo{addr: user_addr, amount: deposit_amount}.double_hash_array();
        let tmp_root = proof.merklize_hash(&leaf_hash).unwrap();

        // check proof root
        assert_eq!(32, tmp_root.len());
        let mut proof_root = [0u8; 32];
        proof_root.copy_from_slice(&tmp_root);
        //assert_eq!(accs_deposit.merkle_root, proof_root);

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
        space = 8 + SummaryAccount::INIT_SPACE,
        payer = payer
    )]
    pub summary: Account<'info, SummaryAccount>,
    pub system_program: Program<'info, System>,
}


#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
    #[account(
        init_if_needed, 
        payer = user, 
        space = 8 + LeafChunkAccount::INIT_SPACE, 
        seeds = [b"leaf", summary.key().as_ref(), &summary.leaf_chunk_count.to_le_bytes()],
        bump)
    ]
    pub leaf: Account<'info, LeafChunkAccount>,
    #[account(mut)]
    pub summary: Account<'info, SummaryAccount>,
}

#[account]
#[derive(InitSpace)]
pub struct SummaryAccount {
    pub leaf_chunk_accounts: [u8; 10232], //1024 * 10 -8, init space , will realloc later
    pub leaf_chunk_count: u64,
    pub leaf_count: u64,
}

#[derive(Accounts)]
#[instruction(len: u32)]
pub struct IncreaseSummaryAccount<'info> {
    #[account(mut, 
        realloc = len as usize, 
        realloc::zero = true, 
        realloc::payer=signer)]
    pub summary: Account<'info, SummaryAccount>,
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(address = system_program::ID)]
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct LeafChunkAccount {
    #[max_len(CHUNK_SIZE)]
    pub leaf_hashes: Vec<[u8; 32]>,
    pub root: [u8; 32],
    pub is_fulled: bool,
}

#[event]
pub struct DepositEvent {
    pub amount: u64,
    pub addr: Pubkey,
    pub leaf_count: u64,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Chunk is full.")]
    ChunkFull,
    #[msg("Leaf not found")]
    LeafNotFound,
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
