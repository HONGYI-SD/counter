import * as anchor from '@coral-xyz/anchor';
import type { Program } from '@coral-xyz/anchor';
import { Keypair } from '@solana/web3.js';
import { assert } from 'chai';
import type { CounterAnchor } from '../target/types/counter_anchor';
import BN from 'bn.js';
import { publicKey } from '@coral-xyz/anchor/dist/cjs/utils';
import bs58 from 'bs58';
import {HashingAlgorithm, MerkleTree} from '../../../svm-merkle-tree/dist/node/svm_merkle_tree'

describe('counter_anchor', () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const payer = provider.wallet as anchor.Wallet;
  
  const program = anchor.workspace.CounterAnchor as Program<CounterAnchor>;
  console.log("program id:", program.programId.toString())

  const treeKeypair = new Keypair();
  console.log("merkle tree account pubkey:", treeKeypair.publicKey.toString())
  const secretKeyString = JSON.stringify(Array.from(treeKeypair.secretKey));
  console.log("merkle tree account secretKeyString:", secretKeyString)

//   const secretKeyString = "[142,188,220,69,71,213,0,137,82,222,243,145,215,76,4,13,252,227,44,122,103,23,63,228,45,123,70,156,140,198,249,103,43,66,31,241,175,159,180,247,93,75,215,197,112,146,19,47,146,224,85,2,113,91,23,173,6,144,46,6,89,53,77,104]"
//   const treeKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(secretKeyString)))
//   console.log("merkle tree account pubkey:", treeKeypair.publicKey.toString())

  // const payerKeypair = Keypair.fromSecretKey(payer.payer.secretKey);
  // const [merkleTreePda, _] = anchor.web3.PublicKey.findProgramAddressSync(
  //   [Buffer.from("merkle_tree")],
  //   program.programId
  // );
  // console.log("merkleTreePda: ", merkleTreePda.toString());

  it('Initialize Counter', async () => {
    await program.methods
      .initializeCounter()
      .accounts({
        merkleTree: treeKeypair.publicKey,
        payer: payer.publicKey,
      })
      .signers([treeKeypair])
      .rpc();
  });

});
