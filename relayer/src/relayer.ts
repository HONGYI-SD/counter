// listen event
// proof verify
import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { Keypair } from '@solana/web3.js';
import idlL1 from '../../anchor/target/idl/counter_anchor.json';
const fs = require("fs");
const path = require("path");

const l1clusterUrl = "http://127.0.0.1:8899";
const connection = new anchor.web3.Connection(l1clusterUrl, "confirmed");
const keypairPath = path.resolve(process.env.HOME!, ".config/solana/id.json")
const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
const keypair = Keypair.fromSecretKey(new Uint8Array(keypairData));
const wallet = new anchor.Wallet(keypair);
const provider = new anchor.AnchorProvider(connection, wallet, {
    preflightCommitment: "confirmed"
});
anchor.setProvider(provider);
const payer = wallet;
console.log("payer: ", payer.publicKey.toString());
const program = new Program(idlL1 as anchor.Idl, provider);
console.log("program id:", program.programId.toString());