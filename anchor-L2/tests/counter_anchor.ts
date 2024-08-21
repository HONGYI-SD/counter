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
  "[91,77,149,98,32,36,73,55,201,65,67,250,84,174,98,135,100,2,156,254,223,21,86,175,206,91,221,157,229,119,209,52,24,192,58,245,255,145,171,151,246,69,156,169,155,241,177,134,189,181,100,235,17,194,222,52,110,161,135,39,54,30,202,176]"
  const summaryKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(summarySecretKeyString)))
  console.log("merkle tree account pubkey:", summaryKeypair.publicKey.toString())
  
  const mintSecretKeyString = 
  "[53,159,234,20,219,16,222,226,6,59,152,240,151,27,39,81,101,225,60,110,170,92,19,38,191,158,184,9,28,214,155,224,226,40,116,188,144,41,40,124,48,34,251,131,255,234,105,137,223,176,57,179,207,197,154,107,97,107,92,112,48,227,136,180]"
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
        await program.methods.updateLeafpdaMerkleRoot(new anchor.BN(depositIndex), Buffer.from(root))
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
            new BN(10),
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
