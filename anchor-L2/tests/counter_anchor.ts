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

  //const signer = anchor.web3.Keypair.generate();
  const connection = anchor.getProvider().connection;
 
  // const treeKeypair = new Keypair();
  // console.log("merkle tree account pubkey:", treeKeypair.publicKey.toString())
  // const secretKeyString = JSON.stringify(Array.from(treeKeypair.secretKey));
  // console.log("merkle tree account secretKeyString:", secretKeyString)

  const secretKeyString = 
  "[248,206,172,123,40,211,229,101,31,246,109,160,157,29,195,83,230,153,120,114,69,20,8,39,19,163,188,148,121,93,170,64,190,32,135,116,84,18,23,80,146,53,106,65,97,205,216,6,37,183,146,236,100,77,180,35,249,45,211,249,218,53,33,139]"
  const summaryKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(secretKeyString)))
  console.log("merkle tree account pubkey:", summaryKeypair.publicKey.toString())

  const localTree = new MerkleTree(HashingAlgorithm.Sha256d, 32);

  it('Increment Counter', async () => {
    try {
      const listenerEvent2 = program.addEventListener("depositEvent", async (event, _slot, _sig) => {
        const depositIndex = event.depositIndex.toNumber() - 1;
        console.log("event depositIndex: ", depositIndex);
        console.log("event leafAccountPubkey: ", event.leafAccountPubkey.toString());
        console.log("event merkle root: ", event.merkleRoot.toString());
        console.log('event amount:', event.amount.toNumber());
        console.log("event user", event.user.toString());
        
        // const addrU8Arr = bs58.decode(event.addr.toString());
        // console.log("addrU8Arr: ", addrU8Arr.toString());
        // const amountByteArr = event.amount.toArray('le', 8);
        // const amountUint8Array = new Uint8Array(amountByteArr);
        // const totalU8Arr = new Uint8Array(amountUint8Array.length + addrU8Arr.length);
        // totalU8Arr.set(amountUint8Array);
        // totalU8Arr.set(addrU8Arr, amountUint8Array.length);
        // localTree.add_leaf(totalU8Arr);
        // localTree.merklize();
        // console.log("new root:", localTree.get_merkle_root().toString());


        // if (eventIdx > 0) {
        //   const proof: MerkleProof = localTree.merkle_proof_index(eventIdx);
        //   console.log("pairing hashes: ", proof.get_pairing_hashes());
        //   console.log("pairing hashes length: ", proof.get_pairing_hashes().length);

        //   // send to verify
        //   let proof_hashes = proof.get_pairing_hashes();
        //   await program.methods.verifyMerkleProof(new BN(event.amount), event.addr, eventIdx, Buffer.from(proof_hashes)).accounts({ user: payer.publicKey, merkleTree: treeKeypair.publicKey }).rpc();
        //   console.log("over !!!");

        // }
      });
      
      const addrU8Arr = bs58.decode(payer.publicKey.toString());
      console.log("addrU8Arr: ", addrU8Arr.toString());
      const depositAmount = new BN(1);
      const amountByteArr = depositAmount.toArray('le', 8);
      const amountUint8Array = new Uint8Array(amountByteArr);
      const totalU8Arr = new Uint8Array(amountUint8Array.length + addrU8Arr.length);
      totalU8Arr.set(amountUint8Array);
      totalU8Arr.set(addrU8Arr, amountUint8Array.length);
      localTree.add_leaf(totalU8Arr);
      localTree.merklize();
      let root = localTree.get_merkle_root();

      const depositIndex = new BN(1);
      await program.methods.updateLeafpdaMerkleRoot(Buffer.from(root), depositIndex)
      .accounts({l2Summary: summaryKeypair.publicKey})
      .rpc();

      const proof: MerkleProof = localTree.merkle_proof_index(0);
      let proof_hashes = proof.get_pairing_hashes();

      await program.methods.verifyMerkleProof(depositAmount, depositIndex.toNumber(), payer.publicKey, Buffer.from(proof_hashes))
      .accounts({l2Summary: summaryKeypair.publicKey})
      .rpc();

      await new Promise((resolve) => setTimeout(resolve, 1000*1));
      program.removeEventListener(listenerEvent2);
    } catch (error) {
      console.log('error:', error.toString())
    }

  });

});
