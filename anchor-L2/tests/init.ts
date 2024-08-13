import * as anchor from '@coral-xyz/anchor';
import type { Program } from '@coral-xyz/anchor';
import { Keypair } from '@solana/web3.js';
import type { CounterAnchor } from '../target/types/counter_anchor';
import { min } from 'bn.js';
import { createInitializeMintInstruction } from '@solana/spl-token';
import { publicKey } from '@coral-xyz/anchor/dist/cjs/utils';
const {
  TOKEN_PROGRAM_ID,
  MintLayout,
} = require('@solana/spl-token');

describe('counter_anchor', () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const admin = provider.wallet as anchor.Wallet;
  
  const program = anchor.workspace.CounterAnchor as Program<CounterAnchor>;
  console.log("program id:", program.programId.toString())

  // l2summary used to store roots
  const l2summaryKeypair = new Keypair();
  const secretKeyString = JSON.stringify(Array.from(l2summaryKeypair.secretKey));
  console.log("l2summary account secretKeyString:", secretKeyString)

  // create mint account keypair
  const mint = anchor.web3.Keypair.generate();
  console.log("mint account secretKeyString:", JSON.stringify(Array.from(mint.secretKey)));
  
  it('Initialize Counter', async () => {
    const mintRent = await provider.connection.getMinimumBalanceForRentExemption(MintLayout.span);
    const createMintAccountIx = anchor.web3.SystemProgram.createAccount({
      fromPubkey: admin.publicKey,
      newAccountPubkey: mint.publicKey,
      lamports: mintRent,
      space: MintLayout.span,
      programId: TOKEN_PROGRAM_ID,
    });
    const initMintIx = createInitializeMintInstruction(
      mint.publicKey,
      9,
      admin.publicKey,
      null,
      TOKEN_PROGRAM_ID
    );
    
    const tx1 = new anchor.web3.Transaction().add(createMintAccountIx, initMintIx);

    await provider.sendAndConfirm(tx1, [admin.payer, mint]);

    await program.methods
      .initializeCounter()
      .accounts({
        l2Summary: l2summaryKeypair.publicKey,
        admin: admin.publicKey,
      })
      .signers([l2summaryKeypair])
      .rpc();

  });

  it('realloc memory', async () => {
      for (let i = 2; i < 11; i++) {
        const r = await program.methods.increaseL2SummaryAccountSpace(10240 * i)
        .accounts({l2Summary: l2summaryKeypair.publicKey, admin: admin.publicKey})
        .rpc();
      }
  });
  
});
