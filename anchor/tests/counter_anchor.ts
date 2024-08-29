import * as anchor from '@coral-xyz/anchor';
import type { Program } from '@coral-xyz/anchor';
import { Keypair, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import type { CounterAnchor } from '../target/types/counter_anchor';
import BN from 'bn.js';
import { HashingAlgorithm, MerkleTree } from '../../../svm-merkle-tree/dist/node/svm_merkle_tree'

const CHUNK_SIZE = 10;
describe('counter_anchor', () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const payer = provider.wallet as anchor.Wallet;

  const program = anchor.workspace.CounterAnchor as Program<CounterAnchor>;
  console.log("program id:", program.programId.toString())

  const secretKeyString = 
  "[142,44,61,2,10,5,204,225,23,12,200,160,131,91,47,23,188,34,15,227,209,125,211,173,160,181,164,198,6,88,42,130,43,150,197,193,22,48,16,189,36,253,77,1,235,114,152,247,119,149,244,41,230,173,60,126,120,117,199,89,234,199,67,83]"
  const summaryKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(secretKeyString)))
  console.log("merkle tree account pubkey:", summaryKeypair.publicKey.toString())

  const localTree = new MerkleTree(HashingAlgorithm.Sha256d, 32);

  enum EventEnum {
    DEPOSITEVENT = 1,
  }
  const EventEnumReverseMapping = {
    1: "DEPOSITEVENT",
};

  it('Increment Counter', async () => {
    try {
      const listenerEvent2 = program.addEventListener("depositEvent", async (event, slot, _sig) => {
        const depositIndex = event.depositIndex.toNumber();
        console.log("event slot: ", slot);
        console.log("event eventslot: ", event.slot.toNumber());
        console.log("event label: ", event.label);
        console.log("event label: ", EventEnumReverseMapping[event.label]);
        console.log("event deposit item hash: ", event.depositItemHash.toString());
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
      
      const programWallet = anchor.web3.Keypair.generate();
      const prograWalletRent = await provider.connection.getMinimumBalanceForRentExemption(0);
      const createWalletIx = SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: programWallet.publicKey,
        space: 0,
        lamports: prograWalletRent,
        programId: program.programId,
      });
      const tx = new Transaction().add(createWalletIx);
      await sendAndConfirmTransaction(provider.connection, tx, [payer.payer, programWallet]);

      for (let i = 0; i < 20; i++) {
        await sendDeposit(program, summaryKeypair, programWallet, payer, 2000);
        await new Promise((resolve) => setTimeout(resolve, 1000*1));
      }

      // await program.methods.withdraw(new anchor.BN(2))
      // .accounts({
      //   user: payer.publicKey,
      //   walletAccount: programWallet.publicKey,
      // })
      // //.signers([programWallet])
      // .rpc();

      const summary = await program.account.summaryAccount.fetch(summaryKeypair.publicKey);
      const leafPda = anchor.web3.PublicKey.findProgramAddressSync(
        [
        Buffer.from("leaf"),
        summaryKeypair.publicKey.toBuffer(),
        new BN(0).toArrayLike(Buffer, 'le', 8)
      ],
        program.programId
      );
      console.log("comput pda1 str: ", leafPda[0].toString());
      console.log("comput pda1: ", leafPda[0].toBytes());
      let pda1 = summary.leafChunkAccounts.slice(0, 32);
      console.log("pda1: ", pda1.toString());
      // let pda2 = summary.leafChunkAccounts.slice(32, 64);
      // console.log("pda2: ", pda2.toLocaleString());

      await new Promise((resolve) => setTimeout(resolve, 1000*1));
      program.removeEventListener(listenerEvent2);
    } catch (error) {
      console.log('error:', error.toString())
    }

  });

});

async function sendDeposit(program: Program<CounterAnchor>, summaryKeypair: Keypair, programWallet: Keypair, payer: anchor.Wallet, depositAmount: number) {
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
  console.log("leafpda: ", leafPda[0].toString())
  const ret = await program.methods.deposit(new BN(depositAmount), payer.publicKey)
  .accounts({ 
    user: payer.publicKey, 
    summary: summaryKeypair.publicKey, 
    leafChunk: leafPda[0],
    walletAccount: programWallet.publicKey,
   })
  //.remainingAccounts(await getRemainingLeafAccounts(program, treeKeypair.publicKey, chunkCount))
  .rpc();
}