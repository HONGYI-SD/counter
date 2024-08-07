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
  "[83,89,236,225,191,226,199,24,157,130,92,49,123,202,43,142,17,51,249,69,122,82,192,145,166,84,93,17,236,95,130,99,12,178,147,199,95,134,181,186,132,145,103,188,4,182,217,174,54,102,43,242,199,235,82,152,27,177,109,113,152,76,252,248]"
  const summaryKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(secretKeyString)))
  console.log("merkle tree account pubkey:", summaryKeypair.publicKey.toString())

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
      
      //console.log("increaseSummaryAccountSpace: ");

      const summary = await program.account.summaryAccount.fetch(summaryKeypair.publicKey);
      
      for (let i = 0; i < 12; i++) {
        await sendDeposit(program, summaryKeypair, payer, i);
      }

      const leafPda = anchor.web3.PublicKey.findProgramAddressSync(
        [
        Buffer.from("leaf"),
        summaryKeypair.publicKey.toBuffer(),
        new BN(0).toArrayLike(Buffer, 'le', 8)
      ],
        program.programId
      );
      console.log("comput pda1: ", leafPda[0].toBytes())
      let pda1 = summary.leafChunkAccounts.slice(0, 32);
      console.log("pda1: ", pda1.toString());
      let pda2 = summary.leafChunkAccounts.slice(32, 64);
      console.log("pda2: ", pda2.toLocaleString());

      await new Promise((resolve) => setTimeout(resolve, 1000*1));
      program.removeEventListener(listenerEvent2);
    } catch (error) {
      console.log('error:', error.toString())
    }

  });

});

async function sendDeposit(program: Program<CounterAnchor>, summaryKeypair: Keypair, payer: anchor.Wallet, depositAmount: number) {
  const summary = await program.account.summaryAccount.fetch(summaryKeypair.publicKey);
  const chunkCount = summary.leafChunkCount;
  const leafPda = anchor.web3.PublicKey.findProgramAddressSync(
    [
    Buffer.from("leaf"),
    summaryKeypair.publicKey.toBuffer(),
    chunkCount.toArrayLike(Buffer, 'le', 8)
  ],
    program.programId
  );
  const ret = await program.methods.deposit(new BN(depositAmount), payer.publicKey)
  .accounts({ user: payer.publicKey, summary: summaryKeypair.publicKey, leafChunk: leafPda[0] })
  //.remainingAccounts(await getRemainingLeafAccounts(program, treeKeypair.publicKey, chunkCount))
  .rpc();
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