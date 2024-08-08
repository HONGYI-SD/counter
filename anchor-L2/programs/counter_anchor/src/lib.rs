#![allow(clippy::result_large_err)]

use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_program;
use dd_merkle_tree::{MerkleTree, HashingAlgorithm};

declare_id!("8VpeCPVs6mjDTgrvXgyhhwqoju86kg7STToPbToJ7u4g");

const CHUNK_SIZE: usize = 10; // temp size, easy for test

#[program]
pub mod counter_anchor {
    use dd_merkle_tree::MerkleProof;

    use super::*;

    pub fn initialize_counter(_ctx: Context<Initialize>) -> Result<()> {
        // let summary = &mut ctx.accounts.summary;
        // summary.leaf_chunk_count = 0u64;
        // summary.leaf_count = 0u64;
        Ok(())
    }

    pub fn increase_l2summary_account_space(
        _ctx: Context<IncreaseL2SummaryAccount>,
        len: u32
    ) -> Result<()> {
        msg!("increase_summary_account_space:{}", len);
        Ok(())
    }

    pub fn view<'info>(
        ctx: Context<'_, '_, 'info, 'info, Deposit<'info>>, 
        _amount: u64, 
        _addr: Pubkey
    ) -> Result<()> {
        let leaf_account_info = ctx.remaining_accounts.get(0).unwrap();
        let leaf_account_data: Account<LeafChunkAccount> = Account::try_from(leaf_account_info)?;
        msg!("leaf hashes: {:?}", leaf_account_data.leaf_hashes);
        Ok(())
    }

    pub fn update_leafpda_merkle_root<'info>(
        ctx: Context<'_, '_, 'info, 'info, UpdataRoot<'info>>, 
        root: Vec<u8>,
        updata_index: u64,
    ) -> Result<()> {
        let _l2summary = &mut ctx.accounts.l2summary;
        let leaf_chunk_pda = &mut ctx.accounts.leaf_chunk_pda;
        leaf_chunk_pda.root.copy_from_slice(&root);
        Ok(())
    }

    pub fn deposit<'info>(
        ctx: Context<'_, '_, 'info, 'info, Deposit<'info>>, 
        amount: u64, 
        user: Pubkey
    ) -> Result<()> {
        // let summary = &mut ctx.accounts.summary;
        // summary.load_mut()?.leaf_chunk_accounts[amount as usize] = 3u8;
        // msg!("value:{}", summary.load_mut()?.leaf_chunk_accounts[amount as usize]);
        
        let summary = &mut ctx.accounts.summary;
        let leaf_chunk_account = &mut ctx.accounts.leaf_chunk;
        
        if leaf_chunk_account.leaf_hashes.len() >= CHUNK_SIZE {
            return Err(ErrorCode::ChunkFull.into());
        }

        let leaf_pda_addr = leaf_chunk_account.key().to_bytes();
        let leaf_chunk_count = summary.load_mut()?.leaf_chunk_count;
        //if summary.load_mut()?.leaf_chunk_accounts[leaf_chunk_count as usize * 32] == 0u8 {
        //    summary.load_mut()?.leaf_chunk_accounts[(leaf_chunk_count as usize * 32)..((leaf_chunk_count + 1) as usize * 32)].copy_from_slice(&leaf_pda_addr);
        //}
        // update pda account
        summary.load_mut()?.leaf_chunk_accounts[(leaf_chunk_count as usize * 32)..((leaf_chunk_count + 1) as usize * 32)].copy_from_slice(&leaf_pda_addr);

        let leaf_hash = DepositInfo{user: user.clone(), amount}.double_hash_array();
        leaf_chunk_account.leaf_hashes.push(leaf_hash);

        let mut tree = MerkleTree::new(HashingAlgorithm::Sha256d, 32);
        tree.add_hashes(<Vec<[u8; 32]> as Clone>::clone(&leaf_chunk_account.leaf_hashes).into_iter().map(|arr| arr.to_vec()).collect()).unwrap();
        tree.merklize().unwrap();
        let root = tree.get_merkle_root().unwrap();
        leaf_chunk_account.root = root.try_into().map_err(|_| "Conversion failed").unwrap();

        let leaf_count: u64 = summary.load_mut()?.leaf_chunk_count * CHUNK_SIZE as u64 + leaf_chunk_account.leaf_hashes.len() as u64 - 1 ;
        summary.load_mut()?.leaf_count = leaf_count;
        emit!(DepositEvent{
            amount, user, 
            deposit_index: leaf_count, 
            merkle_root: leaf_chunk_account.root, 
            leaf_account_pubkey: leaf_chunk_account.key(),
        });

        if leaf_chunk_account.leaf_hashes.len() == CHUNK_SIZE {
            summary.load_mut()?.leaf_chunk_count += 1;
            leaf_chunk_account.is_fulled = true;
        }

        Ok(())
    }

    pub fn verify_merkle_proof(
        ctx: Context<UpdataRoot>, 
        deposit_amount: u64,
        user_addr: Pubkey,
        proof_index: u32,
        proof_hashes: Vec<u8>,
     ) -> Result<()> {
        msg!("deposit_amount:{}", deposit_amount);
        msg!("user_addr: {:?}", user_addr);
        msg!("proof_index: {}", proof_index);
        msg!("proof_hashes: {:?}", proof_hashes);
        
        let _l2summary = &mut ctx.accounts.l2summary;
        let leaf_chunk_pda = &mut ctx.accounts.leaf_chunk_pda;

        // recover the proof
        let proof = MerkleProof::new(HashingAlgorithm::Sha256d, 32, proof_index, proof_hashes);
        let leaf_hash = DepositInfo{user: user_addr, amount: deposit_amount}.double_hash_array();
        let tmp_root = proof.merklize_hash(&leaf_hash).unwrap();

        // check proof root
        assert_eq!(32, tmp_root.len());
        let mut proof_root = [0u8; 32];
        proof_root.copy_from_slice(&tmp_root);
        msg!("leaf_chunk_pda addr: {:?}", leaf_chunk_pda.key().to_string());
        msg!("leaf_chunk_pda root: {:?}", leaf_chunk_pda.root);
        msg!("proof root: {:?}", proof_root);
        //assert_eq!(leaf_chunk_pda.root, proof_root);

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
        payer = payer,
        space = 10 * (1024 as usize),
    )]
    pub l2summary: AccountLoader<'info, L2SummaryAccount>,
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
        seeds = [b"leaf", summary.key().as_ref(), &summary.load_mut()?.leaf_chunk_count.to_le_bytes()],
        bump)
    ]
    pub leaf_chunk: Account<'info, LeafChunkAccount>,
    #[account(mut)]
    pub summary: AccountLoader<'info, L2SummaryAccount>,
}

#[derive(Accounts)]
pub struct UpdataRoot<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
    #[account(
        init_if_needed, 
        payer = user, 
        space = 8 + LeafChunkAccount::INIT_SPACE, 
        seeds = [b"leaf", l2summary.key().as_ref(), &l2summary.load_mut()?.leaf_chunk_count.to_le_bytes()],
        bump)
    ]
    pub leaf_chunk_pda: Account<'info, LeafChunkAccount>,
    #[account(mut)]
    pub l2summary: AccountLoader<'info, L2SummaryAccount>,
}

#[account(zero_copy(unsafe))]
#[repr(C)]
pub struct L2SummaryAccount {
    pub leaf_chunk_count: u64,
    pub leaf_count: u64,
    pub leaf_chunk_accounts: [u8; 10240 * 10 - 8 - 8 - 8], // about 10KB
}

#[derive(Accounts)]
#[instruction(len: u32)]
pub struct IncreaseL2SummaryAccount<'info> {
    #[account(mut, 
        realloc = len as usize, 
        realloc::zero = true, 
        realloc::payer=signer)]
    pub summary: AccountLoader<'info, L2SummaryAccount>,
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
