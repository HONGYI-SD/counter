import * as anchor from '@coral-xyz/anchor';
import type { Program } from '@coral-xyz/anchor';
import { Keypair } from '@solana/web3.js';
import { assert } from 'chai';
import type { CounterAnchor } from '../target/types/counter_anchor';
import BN from 'bn.js';
//import {HashingAlgorithm, MerkleTree} from '../../../svm-merkle-tree/dist/node/svm_merkle_tree'

describe('counter_anchor', () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const payer = provider.wallet as anchor.Wallet;

  const program = anchor.workspace.CounterAnchor as Program<CounterAnchor>;

  console.log("program id:", program.programId.toString())
  // Generate a new keypair for the counter account
  const counterKeypair = new Keypair();

  it('Initialize Counter', async () => {
    // console.log('1111222')
    // const listenerEvent = program.addEventListener('depositEvent', (event, _slot) => {
    //   console.log('amount', event.amount);
    // });

    await program.methods
      .initializeCounter()
      .accounts({
        depositCounter: counterKeypair.publicKey,
        payer: payer.publicKey,
      })
      .signers([counterKeypair])
      .rpc();
    // console.log('33333')  
    // await new Promise((resolve) => setTimeout(resolve, 1000*60*1));
    // program.removeEventListener(listenerEvent);
    // const currentCount = await program.account.accDeposit.fetch(counterKeypair.publicKey);
    
    // assert(currentCount.count.toNumber() === 10, 'Expected initialized count to be 0');
  });

  it('Increment Counter', async () => {
    try {
      const depostOp1 = {
        amount: 100,
        addr: 'DzJQf39X1SF13WYX8LX34ZRA2Pfm55MXKsPByz8hWxvz',
      }
      await program.methods.deposit(new BN(depostOp1.amount), depostOp1.addr).accounts({ accsDeposit: counterKeypair.publicKey }).rpc();
  
      const listenerEvent2 = program.addEventListener("hddEvent", (event, _slot, _sig) => {
        console.log('hdd amount:', event.amount.toNumber());
      });
      //program.addEventListener()
      const depostOp2 = {
        amount: 101,
        addr: 'DzJQf39X1SF13WYX8LX34ZRA2Pfm55MXKsPByz8hWxvz',
      }
      await program.methods.deposit(new BN(depostOp2.amount), depostOp2.addr).accounts({ accsDeposit: counterKeypair.publicKey }).rpc();
  
  
      const currentCount = await program.account.accDeposit.fetch(counterKeypair.publicKey);
      console.log("hdd test root: ", currentCount.merkleRoot)
      console.log("hdd test leaf number: ", currentCount.leafHashes.length)
      console.log("hdd test leaf 0: ", currentCount.leafHashes[0])
      console.log("hdd test leaf 1: ", currentCount.leafHashes[1])
  
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
