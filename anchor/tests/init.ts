import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { Keypair } from '@solana/web3.js';
import type { CounterAnchor } from '../target/types/counter_anchor';
import idl from '../target/idl/counter_anchor.json';
import { publicKey } from '@coral-xyz/anchor/dist/cjs/utils';
import { program } from '@coral-xyz/anchor/dist/cjs/native/system';
const fs = require("fs");
//import path from "path";
const path = require("path");

const main = async () => {
// Configure the client to use the local cluster.
const clusterUrl = "http://127.0.0.1:8899";
const connection = new anchor.web3.Connection(clusterUrl, "confirmed");

const keypairPath = path.resolve(process.env.HOME!, ".config/solana/id.json")
const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
const keypair = Keypair.fromSecretKey(new Uint8Array(keypairData));
const wallet = new anchor.Wallet(keypair);
const provider = new anchor.AnchorProvider(connection, wallet, {
  preflightCommitment: "confirmed"
});
console.log("wallet: ", wallet.publicKey.toString());
anchor.setProvider(provider);
const payer = wallet;

//const programID = new anchor.web3.PublicKey("");
const program = new Program(idl as anchor.Idl, provider);
//const program = anchor.workspace.CounterAnchor as Program<CounterAnchor>;
console.log("program id:", program.programId.toString())

const summaryKeypair = new Keypair();
console.log("merkle tree account pubkey:", summaryKeypair.publicKey.toString())
const secretKeyString = JSON.stringify(Array.from(summaryKeypair.secretKey));
console.log("merkle tree account secretKeyString:", secretKeyString)

//   const secretKeyString = "[142,188,220,69,71,213,0,137,82,222,243,145,215,76,4,13,252,227,44,122,103,23,63,228,45,123,70,156,140,198,249,103,43,66,31,241,175,159,180,247,93,75,215,197,112,146,19,47,146,224,85,2,113,91,23,173,6,144,46,6,89,53,77,104]"
//   const treeKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(secretKeyString)))
//   console.log("merkle tree account pubkey:", treeKeypair.publicKey.toString())

// const payerKeypair = Keypair.fromSecretKey(payer.payer.secretKey);
// const [merkleTreePda, _] = anchor.web3.PublicKey.findProgramAddressSync(
//   [Buffer.from("merkle_tree")],
//   program.programId
// );
// console.log("merkleTreePda: ", merkleTreePda.toString());


  await program.methods
    .initializeCounter()
    .accounts({
      summary: summaryKeypair.publicKey,
      payer: payer.publicKey,
    })
    .signers([summaryKeypair])
    .rpc();


  for (let i = 2; i < 11; i++) {
    const r = await program.methods.increaseSummaryAccountSpace(10240 * i)
    .accounts({summary: summaryKeypair.publicKey, signer: payer.publicKey})
    .rpc();
  }
  
  }

  main();