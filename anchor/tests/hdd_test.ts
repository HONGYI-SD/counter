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

  // const treeKeypair = new Keypair();
  // console.log("merkle tree account pubkey:", treeKeypair.publicKey.toString())
  // const secretKeyString = JSON.stringify(Array.from(treeKeypair.secretKey));
  // console.log("merkle tree account secretKeyString:", secretKeyString)
  const secretKeyString = "[157,72,21,128,78,136,212,118,176,26,107,254,172,132,125,221,234,222,217,207,91,205,26,147,212,11,29,138,145,229,53,78,189,98,179,200,13,203,77,72,132,119,115,159,16,93,166,231,117,221,171,26,186,58,31,98,73,163,66,99,188,213,102,121]"
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
      const listenerEvent2 = program.addEventListener("depositEvent", (event, _slot, _sig) => {
        //console.log('event amount:', event.amount.toNumber());
        //console.log("event addr", event.addr.toString());
        const hdd_amount = 101;
        const hdd_addr = "ed89c53c2635102579a7a002249f7c97460d31ef72baaafd6960be39546c6002";
        //const addrU8Arr = encoder.encode(hdd_addr);
        //const addrU8Arr = new Uint8Array(JSON.parse("[237, 137, 197, 60, 38, 53, 16, 37, 121, 167, 160, 2, 36, 159, 124, 151, 70, 13, 49, 239, 114, 186, 170, 253, 105, 96, 190, 57, 84, 108, 96, 2]"));
        const addrU8Arr = new Uint8Array(Buffer.from(hdd_addr, "hex"));
        console.log("hdd addr bytes:", addrU8Arr);

        const amountByteArr = event.amount.toArray('le', 8);
        const amountUint8Array = new Uint8Array(amountByteArr);
        console.log("hdd amount bytes: ", amountUint8Array);

        const totalU8Arr = new Uint8Array(amountUint8Array.length + addrU8Arr.length);
        totalU8Arr.set(amountUint8Array);
        totalU8Arr.set(addrU8Arr, amountUint8Array.length);
        console.log("totalU8Arr:", totalU8Arr);
        localTree.add_leaf(totalU8Arr);
        localTree.merklize();
        console.log("new root:", localTree.get_merkle_root());
        //localTree.add_leaf(new Uint8Array(JSON.parse(secretKeyString)));
        
        // console.log("new proof 0 :", localTree.merkle_proof_index(1).get_pairing_hashes());
        // console.log("new root:", localTree.get_merkle_root());
      });
      //program.addEventListener()
      const depostOp2 = {
        amount: 101,
      }
      await program.methods.deposit(new BN(depostOp2.amount), payer.publicKey).accounts({ user: payer.publicKey, merkleTree: treeKeypair.publicKey }).rpc();
  
  
      const currentCount = await program.account.merkleTreeAccount.fetch(treeKeypair.publicKey);
      //console.log("hdd test root: ", currentCount.merkleRoot.toString())
      //console.log("hdd test leaf number: ", currentCount.leafHashes.length)
      //console.log("hdd test leaf 0: ", currentCount.leafHashes[0].toString())
      //console.log("hdd test leaf 1: ", currentCount.leafHashes[1].toString())
  
      await new Promise((resolve) => setTimeout(resolve, 1000*5));
      program.removeEventListener(listenerEvent2);
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
