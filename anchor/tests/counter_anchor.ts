import * as anchor from '@coral-xyz/anchor';
import type { Program } from '@coral-xyz/anchor';
import { Keypair } from '@solana/web3.js';
import { assert } from 'chai';
import type { CounterAnchor } from '../target/types/counter_anchor';
import BN from 'bn.js';
import { publicKey } from '@coral-xyz/anchor/dist/cjs/utils';
import bs58 from 'bs58';
import { HashingAlgorithm, MerkleTree, MerkleProof } from '../../../svm-merkle-tree/dist/node/svm_merkle_tree'
import { SYSTEM_PROGRAM_ID } from '@coral-xyz/anchor/dist/cjs/native/system';

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

  const secretKeyString = 
  "[229,29,200,21,27,12,122,202,127,218,228,18,247,240,213,250,245,224,75,161,0,149,240,24,245,251,58,145,227,85,37,196,153,85,72,158,32,226,210,184,79,136,241,167,25,32,90,61,144,8,204,203,46,220,98,121,100,209,164,134,84,65,154,168]"
  const treeKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(secretKeyString)))
  console.log("merkle tree account pubkey:", treeKeypair.publicKey.toString())

  // const [merkleTreePda, _] = anchor.web3.PublicKey.findProgramAddressSync(
  //   [Buffer.from("merkle_tree")],
  //   program.programId
  // );

  const localTree = new MerkleTree(HashingAlgorithm.Sha256d, 32);

  it('Increment Counter', async () => {
    try {
      // const listenerEvent2 = program.addEventListener("depositEvent", async (event, _slot, _sig) => {
      //   const eventIdx = event.index.toNumber() - 1;
      //   console.log("event index: ", eventIdx);
      //   console.log('event amount:', event.amount.toNumber());
      //   console.log("event addr", event.addr.toString());
        
      //   const addrU8Arr = bs58.decode(event.addr.toString());
      //   console.log("addrU8Arr: ", addrU8Arr);
      //   const amountByteArr = event.amount.toArray('le', 8);
      //   const amountUint8Array = new Uint8Array(amountByteArr);
      //   const totalU8Arr = new Uint8Array(amountUint8Array.length + addrU8Arr.length);
      //   totalU8Arr.set(amountUint8Array);
      //   totalU8Arr.set(addrU8Arr, amountUint8Array.length);
      //   localTree.add_leaf(totalU8Arr);
      //   localTree.merklize();
      //   console.log("new root:", localTree.get_merkle_root());
      //   // if (eventIdx > 0) {
      //   //   const proof: MerkleProof = localTree.merkle_proof_index(eventIdx);
      //   //   console.log("pairing hashes: ", proof.get_pairing_hashes());
      //   //   console.log("pairing hashes length: ", proof.get_pairing_hashes().length);

      //   //   // send to verify
      //   //   let proof_hashes = proof.get_pairing_hashes();
      //   //   await program.methods.verifyMerkleProof(new BN(event.amount), event.addr, eventIdx, Buffer.from(proof_hashes)).accounts({ user: payer.publicKey, merkleTree: treeKeypair.publicKey }).rpc();
      //   //   console.log("over !!!");

      //   // }
      // });

      const depostOp1 = {
        amount: 100,
      }
      // const chunkIndexBuffer = Buffer.alloc(4);
      // chunkIndexBuffer.writeUint32LE(10);
      //const temp = new BN(10).toArrayLike(Buffer, 'le', 4);
      //console.log("temp:", temp);
      //console.log("new Uint8Array(temp):", new Uint8Array(temp));
      //const bn = new BN(10);
      //bn.toArrayLike(Buffer, 'le', 8)

      // const buf = Buffer.allocUnsafe(8);
      // buf.writeBigInt64LE(10);

      const chunkCount = 1;
      // const chunkBuffer = Buffer.alloc(8);
      // chunkBuffer.writeBigUInt64BE(BigInt(chunkCount), 0);

      const leafPda1 = anchor.web3.PublicKey.findProgramAddressSync(
        [
        Buffer.from("leaf"),
        treeKeypair.publicKey.toBuffer(),
        new BN(chunkCount).toArrayLike(Buffer, 'le', 8)
      ],
        program.programId
      );
      console.log("pda", leafPda1[0].toString());
      await program.methods.deposit(new BN(depostOp1.amount), payer.publicKey)
      .accounts({ user: payer.publicKey, merkleTree: treeKeypair.publicKey, leaf: leafPda1[0] })
      .remainingAccounts(await getRemainingLeafAccounts(program, treeKeypair.publicKey))
      .rpc();

      // const depostOp2 = {
      //   amount: 101,
      // }
      // await program.methods.deposit(new BN(depostOp2.amount), payer.publicKey).accounts({ user: payer.publicKey, merkleTree: treeKeypair.publicKey }).remainingAccounts().rpc();


      const currentCount = await program.account.merkleTreeAccount.fetch(treeKeypair.publicKey);
      console.log("hdd test root: ", currentCount.merkleRoot.toString())
      console.log("hdd test chunk count: ", currentCount.chunkCount)

      await new Promise((resolve) => setTimeout(resolve, 1000*5));
      //program.removeEventListener(listenerEvent2);
    } catch (error) {
      console.log('error:', error)
    }

  });

});

async function getRemainingLeafAccounts(program, merkleTreePda) {
  const merkleTreeAccount = await program.account.merkleTreeAccount.fetch(merkleTreePda);
  console.log("chunkCount:", merkleTreeAccount.chunkCount);
  const remainingAccounts = [];
  for (let i = 0; i <= merkleTreeAccount.chunkCount; i++) {
      // const chunkBuffer = Buffer.alloc(8);
      // chunkBuffer.writeBigUInt64BE(BigInt(i), 0);
      const [leafPda, _] =  anchor.web3.PublicKey.findProgramAddressSync(
          [Buffer.from("leaf"), merkleTreePda.toBuffer(), new BN(i).toArrayLike(Buffer, 'le', 8)],
          program.programId
      );
      console.log("hdd leafPda:", leafPda);
      remainingAccounts.push({
          pubkey: leafPda,
          isSigner: false,
          isWritable: false,
      });
  }
  return remainingAccounts;
}