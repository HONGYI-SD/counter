import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { Keypair } from '@solana/web3.js';
import idl from '../../anchor-L2/target/idl/counter_anchor.json';
const fs = require("fs");
const path = require("path");

const init = async () => {
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
    console.log("merkle tree account secretKeyString:", secretKeyString);


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
            .accounts({ summary: summaryKeypair.publicKey, signer: payer.publicKey })
            .rpc();
    }

}

init();
