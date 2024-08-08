import * as anchor from '@coral-xyz/anchor';
import type { Program } from '@coral-xyz/anchor';
import { Keypair } from '@solana/web3.js';
import type { CounterAnchor } from '../target/types/counter_anchor';
import BN from 'bn.js';
import bs58 from 'bs58';
import { HashingAlgorithm, MerkleTree, MerkleProof } from '../../../svm-merkle-tree/dist/node/svm_merkle_tree'

const CHUNK_SIZE = 100;
describe('counter_anchor', () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const payer = provider.wallet as anchor.Wallet;
  const program = anchor.workspace.CounterAnchor as Program<CounterAnchor>;
  console.log("program id:", program.programId.toString())

  const secretKeyString = 
  "[98,238,89,234,58,12,104,177,42,244,30,247,110,184,42,74,187,207,8,137,243,202,179,126,4,180,208,42,40,192,66,26,250,234,96,229,144,203,134,254,50,176,231,30,91,97,200,251,143,79,71,27,238,176,119,60,7,7,130,92,108,254,91,254]"
  const summaryKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(secretKeyString)))
  console.log("merkle tree account pubkey:", summaryKeypair.publicKey.toString())
  const localTree = new MerkleTree(HashingAlgorithm.Sha256d, 32);

  it('Increment Counter', async () => {
    try {
      const depositIndex = 8;
      for (let i = 0; i < depositIndex; i++) {
        const depositUserU8Arr = bs58.decode(payer.publicKey.toString());
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
      .accounts({l2Summary: summaryKeypair.publicKey})
      .rpc();

      const randomIndex = Math.floor(Math.random() * 8);
      console.log("random index: ", randomIndex);

      const proof: MerkleProof = localTree.merkle_proof_index(randomIndex);
      let proof_hashes = proof.get_pairing_hashes();
      const depositAmount = randomIndex;
      await program.methods.verifyMerkleProof(new BN(depositAmount), randomIndex, payer.publicKey, Buffer.from(proof_hashes))
      .accounts({l2Summary: summaryKeypair.publicKey})
      .rpc();

    } catch (error) {
      console.log('error:', error.toString())
    }
  });
});
