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

const CHUNK_SIZE = 10;
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
  "[118,147,251,99,28,194,26,5,123,205,43,230,185,172,5,155,5,91,18,119,123,214,61,73,53,167,190,195,81,141,5,228,2,53,165,233,251,206,127,123,189,127,211,206,56,250,242,59,22,66,135,26,138,189,141,146,115,8,42,171,24,96,225,172]"
  const treeKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(secretKeyString)))
  console.log("merkle tree account pubkey:", treeKeypair.publicKey.toString())

  // const [merkleTreePda, _] = anchor.web3.PublicKey.findProgramAddressSync(
  //   [Buffer.from("merkle_tree")],
  //   program.programId
  // );

  const localTree = new MerkleTree(HashingAlgorithm.Sha256d, 32);

  it('Increment Counter', async () => {
    try {
      const listenerEvent2 = program.addEventListener("depositEvent", async (event, _slot, _sig) => {
        const eventIdx = event.leafCount.toNumber() - 1;
        console.log("event index: ", eventIdx);
        console.log('event amount:', event.amount.toNumber());
        console.log("event addr", event.addr.toString());
        
        const addrU8Arr = bs58.decode(event.addr.toString());
        console.log("addrU8Arr: ", addrU8Arr.toString());
        const amountByteArr = event.amount.toArray('le', 8);
        const amountUint8Array = new Uint8Array(amountByteArr);
        const totalU8Arr = new Uint8Array(amountUint8Array.length + addrU8Arr.length);
        totalU8Arr.set(amountUint8Array);
        totalU8Arr.set(addrU8Arr, amountUint8Array.length);
        localTree.add_leaf(totalU8Arr);
        localTree.merklize();
        console.log("new root:", localTree.get_merkle_root().toString());
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

      for (let i = 0; i < 12; i++) {
        const ret = await sendDeposit(program, treeKeypair, payer, i);
      }

      await new Promise((resolve) => setTimeout(resolve, 1000*5));
      program.removeEventListener(listenerEvent2);
    } catch (error) {
      console.log('error:', error.toString())
    }

  });

});

async function sendDeposit(program: Program<CounterAnchor>, treeKeypair: Keypair, payer: anchor.Wallet, depositAmount: number) {
  const merkleTree = await program.account.merkleTreeAccount.fetch(treeKeypair.publicKey);
  const chunkCount = merkleTree.chunkCount;
  const leafPda = anchor.web3.PublicKey.findProgramAddressSync(
    [
    Buffer.from("leaf"),
    treeKeypair.publicKey.toBuffer(),
    chunkCount.toArrayLike(Buffer, 'le', 8)
  ],
    program.programId
  );
  console.log("chunk count : ",chunkCount,  "leaf pda : ", leafPda[0].toString());
  const ret = await program.methods.deposit(new BN(depositAmount), payer.publicKey)
  .accounts({ user: payer.publicKey, merkleTree: treeKeypair.publicKey, leaf: leafPda[0] })
  .remainingAccounts(await getRemainingLeafAccounts(program, treeKeypair.publicKey, chunkCount))
  .rpc();
  console.log("deposit ret: ", ret.toString())
}

async function getRemainingLeafAccounts(program: Program<CounterAnchor>, merkleTreePda: anchor.web3.PublicKey, chunkCount: anchor.BN) {
  const remainingAccounts = [];
  if (chunkCount.toNumber() === 0) {
    return remainingAccounts;
  }
  for (let i = 0; i <= (chunkCount.toNumber()-1); i++) {
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