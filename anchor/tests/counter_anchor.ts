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
  "[4,146,48,111,196,98,192,114,28,28,17,241,122,234,49,12,36,150,122,107,101,183,48,87,15,107,236,77,241,56,250,126,97,164,80,88,57,127,70,240,223,141,197,165,59,61,212,141,203,229,239,124,37,192,110,90,207,180,87,159,22,36,202,91]"
  const treeKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(secretKeyString)))
  console.log("merkle tree account pubkey:", treeKeypair.publicKey.toString())

  // before(async () => {
  //   console.log(new Date(), "requesting airdrop");
  //   const airdropTx = await connection.requestAirdrop(
  //     treeKeypair.publicKey,
  //     5 * anchor.web3.LAMPORTS_PER_SOL
  //   );
  //   await connection.confirmTransaction(airdropTx);
  // });

  const localTree = new MerkleTree(HashingAlgorithm.Sha256d, 32);

  it('Increment Counter', async () => {
    try {
      const listenerEvent2 = program.addEventListener("depositEvent", async (_event, _slot, _sig) => {
        // const eventIdx = event.leafCount.toNumber() - 1;
        // console.log("event index: ", eventIdx);
        // console.log('event amount:', event.amount.toNumber());
        // console.log("event addr", event.addr.toString());
        
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
      // for (let i = 2; i < 101; i++) {
      //   const r = await program.methods.increaseSummaryAccountSpace(10240 * i)
      //   .accounts({summary: treeKeypair.publicKey, signer: payer.publicKey})
      //   //.signers([treeKeypair])
      //   .rpc();
      // }
      
      //console.log("increaseSummaryAccountSpace: ", r);

      for (let i = 0; i < 1; i++) {
        const ret = await sendDeposit(program, treeKeypair, payer, 1024 * 900);
        console.log("xxxxxxxx: ", ret);
      }

      await new Promise((resolve) => setTimeout(resolve, 1000*1));
      program.removeEventListener(listenerEvent2);
    } catch (error) {
      console.log('error:', error.toString())
    }

  });

});

async function sendDeposit(program: Program<CounterAnchor>, treeKeypair: Keypair, payer: anchor.Wallet, depositAmount: number) {
  const summary = await program.account.summaryAccount.fetch(treeKeypair.publicKey);
  const chunkCount = summary.leafChunkCount;
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
  .accounts({ user: payer.publicKey, summary: treeKeypair.publicKey, leafChunk: leafPda[0] })
  //.remainingAccounts(await getRemainingLeafAccounts(program, treeKeypair.publicKey, chunkCount))
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
      //console.log("hdd leafPda:", leafPda);
      remainingAccounts.push({
          pubkey: leafPda,
          isSigner: false,
          isWritable: false,
      });
  }
  return remainingAccounts;
}