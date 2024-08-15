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

  const summarySecretKeyString = 
  "[224,163,8,56,30,168,104,91,179,176,210,66,200,55,238,65,243,51,67,76,30,212,46,186,195,50,156,36,14,168,234,135,26,93,214,247,198,72,206,120,137,211,122,22,48,242,173,205,52,146,195,18,71,83,132,65,197,21,214,70,155,92,202,21]"
  const summaryKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(summarySecretKeyString)))
  console.log("merkle tree account pubkey:", summaryKeypair.publicKey.toString())
  
  const mintSecretKeyString = 
  "[52,16,95,235,224,66,63,68,161,73,95,15,222,211,140,70,161,64,118,98,75,128,88,29,211,145,217,215,153,158,138,109,75,152,133,34,140,215,58,218,2,246,123,166,116,69,15,173,104,84,110,137,149,90,121,97,255,210,59,153,195,228,253,48]";
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
        randomIndex, // depositIndex
        admin.publicKey, 
        Buffer.from(proof_hashes)
      )
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
