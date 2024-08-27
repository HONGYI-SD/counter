import * as anchor from '@coral-xyz/anchor';
import type { Program } from '@coral-xyz/anchor';
import { Keypair } from '@solana/web3.js';
import type { CounterAnchor } from '../target/types/counter_anchor';
import BN from 'bn.js';
import bs58 from 'bs58';
import { HashingAlgorithm, MerkleTree, MerkleProof } from '../../../svm-merkle-tree/dist/node/svm_merkle_tree'
import { AccountLayout, createInitializeAccountInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token';

const CHUNK_SIZE = 10;
describe('counter_anchor', () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const admin = provider.wallet as anchor.Wallet;
  const program = anchor.workspace.CounterAnchor as Program<CounterAnchor>;
  console.log("program id:", program.programId.toString())

  const summarySecretKeyString = 
  "[129,4,187,4,136,38,64,3,160,164,110,196,226,185,39,178,34,95,60,84,161,218,209,85,26,108,5,139,159,189,189,170,142,90,169,57,227,31,160,10,154,6,230,0,126,183,173,140,118,148,174,211,111,40,214,214,110,22,48,243,201,55,241,187]"
  const summaryKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(summarySecretKeyString)))
  console.log("merkle tree account pubkey:", summaryKeypair.publicKey.toString())
  
  const mintSecretKeyString = 
  "[155,192,98,40,104,148,104,59,155,77,54,24,110,8,7,103,196,2,33,84,25,28,240,93,94,142,243,122,215,169,78,14,46,34,17,137,17,78,142,195,87,197,236,211,192,61,82,116,134,143,190,107,157,45,125,173,215,137,209,255,73,228,10,222]"
  const mint = Keypair.fromSecretKey(new Uint8Array(JSON.parse(mintSecretKeyString)));
  const userTokenAccount = anchor.web3.Keypair.generate();
  console.log("userTokenAccount: ", userTokenAccount.publicKey.toString());
  let localTree = new MerkleTree(HashingAlgorithm.Sha256d, 32);

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
      await provider.sendAndConfirm(tx, [admin.payer, userTokenAccount], { commitment: 'confirmed' });

      let depositIndex = 0;
      for (depositIndex = 0; depositIndex < CHUNK_SIZE * 2 + 5; depositIndex++) {
        if (depositIndex != 0 && depositIndex % CHUNK_SIZE === 0) {
          localTree = new MerkleTree(HashingAlgorithm.Sha256d, 32);
        }
        const depositUserU8Arr = bs58.decode(admin.publicKey.toString());
        const amountByteArr = new BN(10).toArray('le', 8);
        const amountUint8Array = new Uint8Array(amountByteArr);
        const depositItem = new Uint8Array(amountUint8Array.length + depositUserU8Arr.length);
        depositItem.set(amountUint8Array);
        depositItem.set(depositUserU8Arr, amountUint8Array.length);
        localTree.add_leaf(depositItem);
        localTree.merklize();
        let root = localTree.get_merkle_root();
        console.log("client root:", root.toString());
        console.log("depositIndex: ", depositIndex);
        const index = new anchor.BN(depositIndex / CHUNK_SIZE);
        const rootPda = anchor.web3.PublicKey.findProgramAddressSync(
          [
            Buffer.from("root"),
            summaryKeypair.publicKey.toBuffer(),
            index.toArrayLike(Buffer, 'le', 8)
          ],
          program.programId
        );
        console.log("rootpda: ", rootPda[0].toString());
        await program.methods.updateMerkleRoot(new anchor.BN(depositIndex), Buffer.from(root))
          .accounts({
            l2Summary: summaryKeypair.publicKey,
            mint: mint.publicKey,
            userTokenAccount: userTokenAccount.publicKey,
            rootChunk: rootPda[0],
            // @ts-ignore
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();

        console.log("update proof end");

        const proof: MerkleProof = localTree.merkle_proof_index(depositIndex % CHUNK_SIZE);
        let proof_hashes = proof.get_pairing_hashes();
        const depositAmount = 10 * depositIndex;

        await program.methods.verifyMerkleProof(
          new anchor.BN(depositIndex), // depositIndex
            new anchor.BN(10),
            admin.publicKey,
            Buffer.from(proof_hashes)
          )
          .accounts({
            l2Summary: summaryKeypair.publicKey,
            mint: mint.publicKey,
            userTokenAccount: userTokenAccount.publicKey,
            rootChunk: rootPda[0],
            // @ts-ignore
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([admin.payer])
          .rpc();
      }
    } catch (error) {
      console.log('error:', error.toString())
    }
  });
});
