import * as anchor from '@coral-xyz/anchor';
import type { Program } from '@coral-xyz/anchor';
import { Keypair } from '@solana/web3.js';
import type { CounterAnchor } from '../target/types/counter_anchor';
import BN from 'bn.js';
import bs58 from 'bs58';
import { HashingAlgorithm, MerkleTree, MerkleProof } from '../../../svm-merkle-tree/dist/node/svm_merkle_tree'
import { AccountLayout, createInitializeAccountInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token';

const CHUNK_SIZE = 100;
describe('counter_anchor', () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const admin = provider.wallet as anchor.Wallet;
  const program = anchor.workspace.CounterAnchor as Program<CounterAnchor>;
  console.log("program id:", program.programId.toString())

  const secretKeyString = 
  "[175,173,102,42,29,108,247,25,22,99,177,144,33,142,149,69,189,179,28,71,228,231,131,82,184,21,159,142,63,84,70,146,252,83,39,91,59,171,81,150,251,106,214,121,80,228,159,176,172,89,108,233,211,44,254,237,198,89,74,169,9,104,4,60]"
  const summaryKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(secretKeyString)))
  console.log("merkle tree account pubkey:", summaryKeypair.publicKey.toString())
  
  const mintSecretKeyString = 
  "[132,242,207,58,97,77,31,118,176,13,192,171,106,174,213,173,214,236,233,73,208,88,0,73,220,35,11,253,91,221,108,114,109,91,2,127,83,74,222,42,130,0,227,17,184,200,152,148,33,0,107,186,64,165,253,212,113,129,61,207,158,65,198,214]";
  const mint = Keypair.fromSecretKey(new Uint8Array(JSON.parse(mintSecretKeyString)));
  const userTokenAccount = anchor.web3.Keypair.generate();
  console.log("userTokenAccount: ", userTokenAccount.publicKey.toString());
  const localTree = new MerkleTree(HashingAlgorithm.Sha256d, 32);

  it('Increment Counter', async () => {
    try {
      const userTokenAccountRent = await provider.connection.getMinimumBalanceForRentExemption(AccountLayout.span);
      const createUserTokenAccountIx = anchor.web3.SystemProgram.createAccount({
        fromPubkey: admin.publicKey,
        newAccountPubkey: userTokenAccount.publicKey,
        lamports: userTokenAccountRent,
        space: AccountLayout.span,
        programId: TOKEN_PROGRAM_ID,
      });
      const initUserTokenAccountIx = createInitializeAccountInstruction(
        userTokenAccount.publicKey,
        mint.publicKey,
        admin.publicKey,
        TOKEN_PROGRAM_ID
      );
      const tx = new anchor.web3.Transaction()
      .add(createUserTokenAccountIx)
      .add(initUserTokenAccountIx);
      await provider.sendAndConfirm(tx, [admin.payer, userTokenAccount], {commitment: 'confirmed'});

      const depositIndex = 8;
      for (let i = 0; i < depositIndex; i++) {
        const depositUserU8Arr = bs58.decode(admin.publicKey.toString());
        const amountByteArr = new BN(i).toArray('le', 8);
        const amountUint8Array = new Uint8Array(amountByteArr);
        const depositItem = new Uint8Array(amountUint8Array.length + depositUserU8Arr.length);
        depositItem.set(amountUint8Array);
        depositItem.set(depositUserU8Arr, amountUint8Array.length);
        localTree.add_leaf(depositItem);
      }
      localTree.merklize();
      let root = localTree.get_merkle_root();
      console.log("client root:", root);
      await program.methods.updateLeafpdaMerkleRoot(Buffer.from(root), new BN(depositIndex-1))
      .accounts({
        l2Summary: summaryKeypair.publicKey,
        mint: mint.publicKey,
        userTokenAccount: userTokenAccount.publicKey,
        // @ts-ignore
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

      const randomIndex = Math.floor(Math.random() * 8);
      console.log("random index: ", randomIndex);

      const proof: MerkleProof = localTree.merkle_proof_index(randomIndex);
      let proof_hashes = proof.get_pairing_hashes();
      const depositAmount = randomIndex;
      
      await program.methods.verifyMerkleProof(
        new BN(depositAmount), 
        randomIndex, admin.publicKey, 
        Buffer.from(proof_hashes
      ))
      .accounts({
        l2Summary: summaryKeypair.publicKey,
        mint: mint.publicKey,
        userTokenAccount: userTokenAccount.publicKey,
        // @ts-ignore
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([admin.payer])
      .rpc();

    } catch (error) {
      console.log('error:', error.toString())
    }
  });
});
