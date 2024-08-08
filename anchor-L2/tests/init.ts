import * as anchor from '@coral-xyz/anchor';
import type { Program } from '@coral-xyz/anchor';
import { Keypair } from '@solana/web3.js';
import type { CounterAnchor } from '../target/types/counter_anchor';

describe('counter_anchor', () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const payer = provider.wallet as anchor.Wallet;
  
  const program = anchor.workspace.CounterAnchor as Program<CounterAnchor>;
  console.log("program id:", program.programId.toString())

  const l2summaryKeypair = new Keypair();
  console.log("merkle tree account pubkey:", l2summaryKeypair.publicKey.toString())
  const secretKeyString = JSON.stringify(Array.from(l2summaryKeypair.secretKey));
  console.log("merkle tree account secretKeyString:", secretKeyString)

  it('Initialize Counter', async () => {
    await program.methods
      .initializeCounter()
      .accounts({
        l2Summary: l2summaryKeypair.publicKey,
        payer: payer.publicKey,
      })
      .signers([l2summaryKeypair])
      .rpc();
  });

  it('realloc memory', async () => {
      for (let i = 2; i < 11; i++) {
        const r = await program.methods.increaseL2SummaryAccountSpace(10240 * i)
        .accounts({l2Summary: l2summaryKeypair.publicKey, signer: payer.publicKey})
        .rpc();
      }
  });
  
});
