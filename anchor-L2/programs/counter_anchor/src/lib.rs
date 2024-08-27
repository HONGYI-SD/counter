#![allow(clippy::result_large_err)]

use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_program;
use dd_merkle_tree::{HashingAlgorithm};
use anchor_spl::token::{Mint, MintTo, Token, TokenAccount};

declare_id!("G1HWwVwwE7jEszCuiJzFPUqvec5Qq9RosQZrutkpPJDb");

const CHUNK_SIZE: usize = 10; // temp size, easy for test
const HASH_SIZE: usize = 32;

#[program]
pub mod counter_anchor {
    use anchor_spl::token;
    use dd_merkle_tree::MerkleProof;

    use super::*;

    pub fn initialize_counter(_ctx: Context<L2Initialize>) -> Result<()> {
        Ok(())
    }

    pub fn increase_l2_summary_account_space(
        _ctx: Context<IncreaseL2SummaryAccount>,
        _len: u32
    ) -> Result<()> {
        Ok(())
    }

    pub fn update_merkle_root<'info>(
        ctx: Context<'_, '_, 'info, 'info, UpdateRoot<'info>>,
        deposit_index: u64,
        root: Vec<u8>,
    ) -> Result<()> {
        let l2_summary = &mut ctx.accounts.l2_summary;
        let root_chunk_acc = &mut ctx.accounts.root_chunk;
        // avoid repeat update
        msg!("root_chunk_acc.root_infos.len(): {:?}", root_chunk_acc.root_infos.len());
        msg!("deposit_index as usize % CHUNK_SIZE: {:?}", deposit_index as usize % CHUNK_SIZE);
        require_eq!(root_chunk_acc.root_infos.len(), deposit_index as usize % CHUNK_SIZE );
        let root_info = RootInfo{
            root: root.try_into().map_err(|_| "Conversion failed").unwrap(),
            is_minted: false,
        };
        root_chunk_acc.root_infos.push(root_info);
        
        // l2_summary need to store root_chunk_acc.key
        if deposit_index as usize % CHUNK_SIZE == 0{
            let start = deposit_index as usize / CHUNK_SIZE * HASH_SIZE;
            msg!("update root chunk pdas, start: {:?}, end: {:?}", start, start + HASH_SIZE);
            l2_summary.load_mut()?.root_chunk_pdas[start..(start + HASH_SIZE)].copy_from_slice(&root_chunk_acc.key().to_bytes());
        }
        
        if root_chunk_acc.root_infos.len() == CHUNK_SIZE {
            l2_summary.load_mut()?.root_chunk_count += 1u64;
        }
        Ok(())
    }

    pub fn verify_merkle_proof(
        ctx: Context<UpdateRoot>, 
        deposit_index: u64,
        deposit_amount: u64,
        user_addr: Pubkey,
        proof_hashes: Vec<u8>,
     ) -> Result<()> {
        msg!("deposit_amount:{}", deposit_amount);
        msg!("user_addr: {:?}", user_addr);
        msg!("proof_hashes: {:?}", proof_hashes);
        
        let root_chunk_acc = &mut ctx.accounts.root_chunk;
        require!(root_chunk_acc.root_infos.len() >= deposit_index as usize % CHUNK_SIZE, ErrorCode::LeafNotFound);
        let root_info = &mut root_chunk_acc.root_infos[deposit_index as usize % CHUNK_SIZE];
        msg!("root on chain: {:?}", root_info.root);

        // recover the proof
        let proof = MerkleProof::new(HashingAlgorithm::Sha256d, 32, deposit_index.try_into()?, proof_hashes);
        let leaf_hash = DepositInfo{user: user_addr, amount: deposit_amount}.double_hash_array();
        let proof_root = proof.merklize_hash(&leaf_hash).unwrap();
        msg!("proof root: {:?}", proof_root);

        require!(proof_root.len() == 32, ErrorCode::ProofRootLenErr);
        let root: [u8; 32] = proof_root.try_into().map_err(|_| "convert failed").unwrap();
        if root_info.root != root {
            return Err(error!(ErrorCode::ProofVerifyFailed));
        }

        if root_info.is_minted == true {
            msg!("reject repeat mint, deposit index {:?}", deposit_index)
        }else{
            let cpi_accounts = MintTo{
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.user_token_account.to_account_info(),
                authority: ctx.accounts.admin.to_account_info(),
            };
            let cpi_program = ctx.accounts.token_program.to_account_info();
            let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
            token::mint_to(cpi_ctx, deposit_amount)?;
            root_info.is_minted = true;
        }

        Ok(())

    }
}

#[derive(Accounts)]
pub struct L2Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        space = 10 * (1024 as usize),
    )]
    pub l2_summary: AccountLoader<'info, L2SummaryAccount>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(deposit_index: u64)]
pub struct UpdateRoot<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
    #[account(mut)]
    pub l2_summary: AccountLoader<'info, L2SummaryAccount>,
    #[account(
        init_if_needed, 
        payer = admin, 
        space = 8 + RootChunkAccount::INIT_SPACE, 
        seeds = [b"root", l2_summary.key().as_ref(), (deposit_index / (CHUNK_SIZE as u64)).to_le_bytes().as_ref()],
        bump)
    ]
    pub root_chunk: Account<'info, RootChunkAccount>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[account(zero_copy(unsafe))]
#[repr(C)]
pub struct L2SummaryAccount {
    pub root_chunk_count: u64,
    pub root_count: u64,
    pub root_chunk_pdas: [u8; 10240 * 10 - 8 - 8 - 8], // about 10KB
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
#[derive(InitSpace)]
pub struct RootInfo {
    root: [u8; 32],
    is_minted: bool,
}
#[account]
#[derive(InitSpace)]
pub struct RootChunkAccount {
    #[max_len(CHUNK_SIZE)]
    pub root_infos: Vec<RootInfo>,
    pub is_fulled: bool,
    pub deposit_index: u64,
}

#[derive(Accounts)]
#[instruction(len: u32)]
pub struct IncreaseL2SummaryAccount<'info> {
    #[account(mut, 
        realloc = len as usize, 
        realloc::zero = true, 
        realloc::payer=admin)]
    pub l2_summary: AccountLoader<'info, L2SummaryAccount>,
    #[account(mut)]
    pub admin: Signer<'info>,
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
    #[msg("Proof root len is error")]
    ProofRootLenErr,
    #[msg("Proof verify failed")]
    ProofVerifyFailed,
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
