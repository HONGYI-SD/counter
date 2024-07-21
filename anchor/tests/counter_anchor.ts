import * as anchor from '@coral-xyz/anchor';
import type { Program } from '@coral-xyz/anchor';
import { Keypair } from '@solana/web3.js';
import { assert } from 'chai';
import type { CounterAnchor } from '../target/types/counter_anchor';
import BN from 'bn.js';
import { publicKey } from '@coral-xyz/anchor/dist/cjs/utils';
import bs58 from 'bs58';
import { HashingAlgorithm, MerkleTree, MerkleProof } from '../../../svm-merkle-tree/dist/node/svm_merkle_tree'

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
  const secretKeyString = "[38,15,32,78,53,174,30,196,44,155,48,74,66,71,101,22,54,211,147,191,188,86,127,47,229,45,168,194,199,161,69,220,247,207,159,239,240,27,118,78,101,143,181,41,10,83,243,62,14,57,193,27,90,183,127,66,54,219,229,187,52,70,131,147]"
  const treeKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(secretKeyString)))
  console.log("merkle tree account pubkey:", treeKeypair.publicKey.toString())

  const localTree = new MerkleTree(HashingAlgorithm.Sha256d, 32);

  it('Increment Counter', async () => {
    try {
      

      //const encoder = new TextEncoder();
      //let eventCounter:number = 0;
      const listenerEvent2 = program.addEventListener("depositEvent", async (event, _slot, _sig) => {
        const eventIdx = event.index.toNumber() - 1;
        console.log("event index: ", eventIdx);
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
        //localTree.add_leaf(totalU8Arr);
        //localTree.add_leaf(totalU8Arr);
        localTree.merklize();
        console.log("new root:", localTree.get_merkle_root());
        //console.log("local tree: ", localTree)
        if (eventIdx > 0) {
          const proof: MerkleProof = localTree.merkle_proof_index(eventIdx);
          console.log("pairing hashes: ", proof.get_pairing_hashes());
          console.log("pairing hashes length: ", proof.get_pairing_hashes().length);
          //proof.merklize_hash(localTree.)
          //localTree.add_leaf(new Uint8Array(JSON.parse(secretKeyString)));

          // console.log("new proof 0 :", localTree.merkle_proof_index(1).get_pairing_hashes());
          // console.log("new root:", localTree.get_merkle_root());

          // send to verify
          let proof_hashes = proof.get_pairing_hashes();
          await program.methods.verifyMerkleProof(new BN(event.amount), event.addr, eventIdx, Buffer.from(proof_hashes)).accounts({ user: payer.publicKey, merkleTree: treeKeypair.publicKey }).rpc();
          console.log("over !!!");
          //program.removeEventListener(listenerEvent2);

        }

        //eventCounter++;

      });

      const depostOp1 = {
        amount: 100,
      }
      await program.methods.deposit(new BN(depostOp1.amount), payer.publicKey).accounts({ user: payer.publicKey, merkleTree: treeKeypair.publicKey }).rpc();

      const depostOp2 = {
        amount: 101,
      }
      await program.methods.deposit(new BN(depostOp2.amount), payer.publicKey).accounts({ user: payer.publicKey, merkleTree: treeKeypair.publicKey }).rpc();


      const currentCount = await program.account.merkleTreeAccount.fetch(treeKeypair.publicKey);
      console.log("hdd test root: ", currentCount.merkleRoot.toString())
      console.log("hdd test leaf number: ", currentCount.leafHashes.length)
      // console.log("hdd test leaf 0: ", currentCount.leafHashes[0].toString())
      // console.log("hdd test leaf 1: ", currentCount.leafHashes[1].toString())

      await new Promise((resolve) => setTimeout(resolve, 1000*5));
      program.removeEventListener(listenerEvent2);
    } catch (error) {
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
