import * as anchor from '@coral-xyz/anchor';
import type { Program } from '@coral-xyz/anchor';
import { Keypair } from '@solana/web3.js';
import { assert } from 'chai';
import type { CounterAnchor } from '../target/types/counter_anchor';
import BN from 'bn.js';
import { publicKey } from '@coral-xyz/anchor/dist/cjs/utils';
import bs58 from 'bs58';
import {HashingAlgorithm, MerkleTree, MerkleProof} from '../../../svm-merkle-tree/dist/node/svm_merkle_tree'

describe('counter_anchor', () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const payer = provider.wallet as anchor.Wallet;
  
  const program = anchor.workspace.CounterAnchor as Program<CounterAnchor>;
  console.log("program id:", program.programId.toString())

  // const treeKeypair = new Keypair();
  // console.log("merkle tree account pubkey:", treeKeypair.publicKey.toString())
  // const secretKeyString = JSON.stringify(Array.from(treeKeypair.secretKey));
  // console.log("merkle tree account secretKeyString:", secretKeyString)
  const secretKeyString = "[92,193,0,147,6,154,227,107,155,106,95,151,23,170,142,185,58,147,206,206,106,212,67,181,66,122,246,217,112,20,55,166,113,51,231,132,157,0,91,213,53,143,1,159,119,252,197,177,38,198,202,33,69,170,29,219,221,53,77,109,20,117,253,254]"
  const treeKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(secretKeyString)))
  console.log("merkle tree account pubkey:", treeKeypair.publicKey.toString())

  const localTree = new MerkleTree(HashingAlgorithm.Sha256d, 32);
  
  it('Increment Counter', async () => {
    try {
      // const depostOp1 = {
      //   amount: 100,
      // }
      // await program.methods.deposit(new BN(depostOp1.amount), payer.publicKey).accounts({ user: payer.publicKey, merkleTree: treeKeypair.publicKey }).rpc();
  
      const encoder = new TextEncoder();
      const listenerEvent2 = program.addEventListener("depositEvent", async (event, _slot, _sig) => {
        console.log('event amount:', event.amount.toNumber());
        console.log("event addr", event.addr.toString());
        //const addrU8Arr = encoder.encode(event.addr.toString());
        //const addrU8Arr = new Uint8Array(Buffer.from(event.addr.toString(), ''));
        const addrU8Arr = bs58.decode(event.addr.toString());
        console.log("addrU8Arr: ", addrU8Arr);
        const amountByteArr = event.amount.toArray('le', 8);
        const amountUint8Array = new Uint8Array(amountByteArr);
        const totalU8Arr = new Uint8Array(amountUint8Array.length + addrU8Arr.length);
        totalU8Arr.set(amountUint8Array);
        totalU8Arr.set(addrU8Arr, amountUint8Array.length);
        localTree.add_leaf(totalU8Arr);
        localTree.add_leaf(totalU8Arr);
        //localTree.add_leaf(totalU8Arr);
        localTree.merklize();
        console.log("new root:", localTree.get_merkle_root());
        console.log("local tree: ", localTree)
        const proof:MerkleProof = localTree.merkle_proof_index(1);
        console.log("pairing hashes: ", proof.get_pairing_hashes());
        //proof.merklize_hash(localTree.)
        //localTree.add_leaf(new Uint8Array(JSON.parse(secretKeyString)));
        
        // console.log("new proof 0 :", localTree.merkle_proof_index(1).get_pairing_hashes());
        // console.log("new root:", localTree.get_merkle_root());

        // send to verify
        let proof_hashes = proof.get_pairing_hashes();
        await program.methods.verifyMerkleProof(new BN(event.amount), event.addr, 1, Buffer.from(proof_hashes)).accounts({ user: payer.publicKey, merkleTree: treeKeypair.publicKey }).rpc();
        console.log("over !!!");
        program.removeEventListener(listenerEvent2);
      });
      //program.addEventListener()
      const depostOp2 = {
        amount: 101,
      }
      await program.methods.deposit(new BN(depostOp2.amount), payer.publicKey).accounts({ user: payer.publicKey, merkleTree: treeKeypair.publicKey }).rpc();
  
  
      const currentCount = await program.account.merkleTreeAccount.fetch(treeKeypair.publicKey);
      console.log("hdd test root: ", currentCount.merkleRoot.toString())
      // console.log("hdd test leaf number: ", currentCount.leafHashes.length)
      // console.log("hdd test leaf 0: ", currentCount.leafHashes[0].toString())
      //console.log("hdd test leaf 1: ", currentCount.leafHashes[1].toString())
  
      // await new Promise((resolve) => setTimeout(resolve, 1000*5));
      // program.removeEventListener(listenerEvent2);
    }catch(error) {
      console.log('error:', error)
    }
    
    //assert(currentCount.merkleRoot === currentCount.leafHashes[0], 'Expected  count to be 1');
  });


  //const merkleTree = new MerkleTree(HashingAlgorithm.Sha256d, 32);
  
  // it('Increment Counter Again', async () => {
  //   await program.methods.increment().accounts({ counter: counterKeypair.publicKey }).rpc();

  //   const currentCount = await program.account.counter.fetch(counterKeypair.publicKey);

  //   assert(currentCount.amount.toNumber() === 2, 'Expected  count to be 2');
  // });

});
