import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { Keypair } from '@solana/web3.js';
import idl from '../../anchor-L2/target/idl/counter_anchor.json';
import type { CounterAnchor } from '../../anchor-L2/target/types/counter_anchor';
import { createInitializeMintInstruction } from '@solana/spl-token';
//import * as spl from '@solana/spl-token';
const {
    TOKEN_PROGRAM_ID,
    MintLayout,
  } = require('@solana/spl-token');
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
    const admin = wallet;

    //const programID = new anchor.web3.PublicKey("");
    const program = new Program(idl as anchor.Idl, provider) as unknown as Program<CounterAnchor>;
    //const program = anchor.workspace.CounterAnchor as Program<CounterAnchor>;
    console.log("program id:", program.programId.toString())

    // l2summary used to store roots
    const l2summaryKeypair = new Keypair();
    const secretKeyString = JSON.stringify(Array.from(l2summaryKeypair.secretKey));
    console.log("l2summary account secretKeyString:", secretKeyString)
    console.log("l2summary pubkey: ", l2summaryKeypair.publicKey.toString());
    // create mint account keypair
    const mint = anchor.web3.Keypair.generate();
    console.log("mint account secretKeyString:", JSON.stringify(Array.from(mint.secretKey)));
    console.log("mint pubkey: ", mint.publicKey.toString());

    const mintRent = await provider.connection.getMinimumBalanceForRentExemption(MintLayout.span);
    const createMintAccountIx = anchor.web3.SystemProgram.createAccount({
      fromPubkey: admin.publicKey,
      newAccountPubkey: mint.publicKey,
      lamports: mintRent,
      space: MintLayout.span,
      programId: TOKEN_PROGRAM_ID,
    });
    const initMintIx = createInitializeMintInstruction(
      mint.publicKey,
      9,
      admin.publicKey,
      null,
      TOKEN_PROGRAM_ID
    );
    
    const tx1 = new anchor.web3.Transaction().add(createMintAccountIx, initMintIx);

    await provider.sendAndConfirm(tx1, [admin.payer, mint]);

    await program.methods
      .initializeCounter()
      .accounts({
        l2Summary: l2summaryKeypair.publicKey,
        admin: admin.publicKey,
      })
      .signers([l2summaryKeypair])
      .rpc();

    for (let i = 2; i < 11; i++) {
    const r = await program.methods.increaseL2SummaryAccountSpace(10240 * i)
    .accounts({l2Summary: l2summaryKeypair.publicKey, admin: admin.publicKey})
    .rpc();
    }
}

init();
