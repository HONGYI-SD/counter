import * as anchor from '@coral-xyz/anchor';
import type { Program } from '@coral-xyz/anchor';
import { Keypair } from '@solana/web3.js';
import { assert } from 'chai';
import type { CounterAnchor } from '../target/types/counter_anchor';
import BN from 'bn.js';
import { publicKey } from '@coral-xyz/anchor/dist/cjs/utils';
import bs58 from 'bs58';
//import {HashingAlgorithm, MerkleTree} from '../../../svm-merkle-tree/dist/node/svm_merkle_tree'

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
  const secretKeyString = "[142,188,220,69,71,213,0,137,82,222,243,145,215,76,4,13,252,227,44,122,103,23,63,228,45,123,70,156,140,198,249,103,43,66,31,241,175,159,180,247,93,75,215,197,112,146,19,47,146,224,85,2,113,91,23,173,6,144,46,6,89,53,77,104]"
  const treeKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(secretKeyString)))
  console.log("merkle tree account pubkey:", treeKeypair.publicKey.toString())

  /*
  it('Initialize Counter', async () => {
    await program.methods
      .initializeCounter()
      .accounts({
        merkleTree: treeKeypair.publicKey,
        payer: payer.publicKey,
      })
      .signers([treeKeypair])
      .rpc();
    // console.log('33333')  
    // await new Promise((resolve) => setTimeout(resolve, 1000*60*1));
    // program.removeEventListener(listenerEvent);
    // const currentCount = await program.account.accDeposit.fetch(counterKeypair.publicKey);
    
    // assert(currentCount.count.toNumber() === 10, 'Expected initialized count to be 0');
  });
*/
  
  it('Increment Counter', async () => {
    try {
      const depostOp1 = {
        amount: 100,
      }
      await program.methods.deposit(new BN(depostOp1.amount), payer.publicKey).accounts({ user: payer.publicKey, merkleTree: treeKeypair.publicKey }).rpc();
  
      const listenerEvent2 = program.addEventListener("depositEvent", (event, _slot, _sig) => {
        console.log('event amount:', event.amount.toNumber());
        console.log("event addr", event.addr.toString());
      });
      //program.addEventListener()
      const depostOp2 = {
        amount: 101,
      }
      await program.methods.deposit(new BN(depostOp2.amount), payer.publicKey).accounts({ user: payer.publicKey, merkleTree: treeKeypair.publicKey }).rpc();
  
  
      const currentCount = await program.account.merkleTreeAccount.fetch(treeKeypair.publicKey);
      console.log("hdd test root: ", currentCount.merkleRoot.toString())
      console.log("hdd test leaf number: ", currentCount.leafHashes.length)
      console.log("hdd test leaf 0: ", currentCount.leafHashes[0].toString())
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
