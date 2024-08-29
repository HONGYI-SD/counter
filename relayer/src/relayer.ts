// listen event
// proof verify
import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import idlL1 from '../../anchor/target/idl/counter_anchor.json';
import idlL2 from '../../anchor-L2/target/idl/counter_anchor.json';
import type { CounterAnchor } from '../../anchor/target/types/counter_anchor';
import type { CounterAnchor as CounterAnchorL2} from '../../anchor-L2/target/types/counter_anchor';
import { program } from '@coral-xyz/anchor/dist/cjs/native/system';
import { HashingAlgorithm, MerkleTree, MerkleProof } from '../../../svm-merkle-tree/dist/node/svm_merkle_tree'
import DepositService from './pgsql/DepositService';
import * as dotenv from 'dotenv'
const {
    TOKEN_PROGRAM_ID,
  } = require('@solana/spl-token');
const fs = require("fs");
const path = require("path");
const CHUNK_SIZE = 10;
dotenv.config();
const L1SUMMARYPUBKEY = process.env.L1SUMMARYPUBKEY;
const L2SUMMARYPUBKEY = process.env.L2SUMMARYPUBKEY;
const MINTPUBKEY = process.env.MINTPUBKEY;
const USERTOKENACCOUNTPUBKEY = process.env.USERTOKENACCOUNTPUBKEY;
console.log("L1SUMMARYPUBKEY:", L1SUMMARYPUBKEY);
console.log("L2SUMMARYPUBKEY:", L2SUMMARYPUBKEY);
console.log("MINTPUBKEY:", MINTPUBKEY);
console.log("USERTOKENACCOUNTPUBKEY:", USERTOKENACCOUNTPUBKEY);

const l1ClusterUrl = "http://127.0.0.1:8899";
const l1Connection = new anchor.web3.Connection(l1ClusterUrl, "confirmed");
const l1KeypairPath = path.resolve(process.env.HOME!, ".config/solana/id.json");
const l1KeypairData = JSON.parse(fs.readFileSync(l1KeypairPath, "utf-8"));
const l1Keypair = Keypair.fromSecretKey(new Uint8Array(l1KeypairData));
const l1Wallet = new anchor.Wallet(l1Keypair);
const l1Provider = new anchor.AnchorProvider(l1Connection, l1Wallet, {preflightCommitment: "confirmed"});
anchor.setProvider(l1Provider);
const l1Payer = l1Wallet;
console.log("l1Payer: ", l1Payer.publicKey.toString());
const programL1 = new Program(idlL1 as anchor.Idl, l1Provider) as unknown as Program<CounterAnchor>;
console.log("l1 program id:", programL1.programId.toString());

const l2ClusterUrl = "http://127.0.0.1:8899"
const l2Connection = new anchor.web3.Connection(l2ClusterUrl, "confirmed");
const l2KeypairPath = path.resolve(process.env.HOME!, ".config/solana/id.json");
const l2KeypairData = JSON.parse(fs.readFileSync(l2KeypairPath, "utf-8"));
const l2Keypair = Keypair.fromSecretKey(new Uint8Array(l2KeypairData));
const l2Wallet = new anchor.Wallet(l2Keypair);
const l2Provider = new anchor.AnchorProvider(l2Connection, l2Wallet, {preflightCommitment: "confirmed"});
anchor.setProvider(l2Provider);
const l2Payer = l2Wallet;
console.log("l2Payer: ", l2Payer.publicKey.toString());
const programL2 = new Program(idlL2 as anchor.Idl, l2Provider) as unknown as Program<CounterAnchorL2>;
console.log("l2 program id: ", programL2.programId.toString());

let localTree = new MerkleTree(HashingAlgorithm.Sha256d, 32);
const depositService = new DepositService();

const initRelayer = async () => {
    // todo: init db
}

const DEPOSITINDEXPREFIX = 'Program log: deposit_index:'
const DEPOSITUSERPREFIX = 'Program log: deposit_user:'
const DEPOSITAMOUNTPREFIX = 'Program log: deposit_amount:'
const DEPOSITITEMHASH = 'Program log: deposit_item_hash:'
function parselog(logs: string[]):[number, string, number, number[]]{
    console.log("logs: ", logs);
    let indexlog = logs.find((indexlog) => indexlog.startsWith(DEPOSITINDEXPREFIX));
    indexlog = indexlog.slice(DEPOSITINDEXPREFIX.length);
    console.log("index log: ", indexlog);

    let userlog = logs.find((userlog) => userlog.startsWith(DEPOSITUSERPREFIX));
    userlog = userlog.slice(DEPOSITUSERPREFIX.length);
    console.log("user log: ", userlog);

    let amountlog = logs.find((amountlog) => amountlog.startsWith(DEPOSITAMOUNTPREFIX));
    amountlog = amountlog.slice(DEPOSITAMOUNTPREFIX.length);
    console.log("amount log: ", amountlog);

    let hashlog = logs.find((hashlog) => hashlog.startsWith(DEPOSITITEMHASH));
    hashlog = hashlog.slice(DEPOSITITEMHASH.length);
    console.log("hash log: ", hashlog);
    const hash: number[] = JSON.parse(hashlog);

    return [Number(indexlog),userlog, Number(amountlog), hash];
}

const relayerSync = async () => {
    while(true) {
        const latestDepositIdxDB = await depositService.getLatestDepositItem();
        console.log("local latest deposit index is: ", latestDepositIdxDB);
        const l1SummaryAcc = programL1.account.summaryAccount.fetch(new anchor.web3.PublicKey(L1SUMMARYPUBKEY));
        const latestDepositIdxChain = (await l1SummaryAcc).leafCount;
        console.log("local latest deposit index is: ", latestDepositIdxDB);
        console.log("on chain latest deposit index is: ", latestDepositIdxChain);
        if (new anchor.BN(latestDepositIdxDB) === latestDepositIdxChain) {
            console.log("there is no sync work");
            break;
        }
        for (let index = new anchor.BN(latestDepositIdxDB); index < latestDepositIdxChain; index.add(new anchor.BN(1))) {
            const leafChunk = anchor.web3.PublicKey.findProgramAddressSync(
                [
                Buffer.from("leaf"),
                new anchor.web3.PublicKey(L1SUMMARYPUBKEY).toBuffer(),
                new anchor.BN(index.toNumber() / CHUNK_SIZE).toArrayLike(Buffer, 'le', 8)
              ],
                programL1.programId
            )[0];

            const simulateResponse = await programL1.methods.viewDepositItem(index)
            .accounts({ 
                user: l1Payer.publicKey, 
                summary: new anchor.web3.PublicKey(L1SUMMARYPUBKEY), 
                leafChunk: leafChunk,
            })
            .simulate();

            const [idx, user, amount, hash] = parselog([...simulateResponse.raw]);
            console.log("", idx, "", user, " ", amount, " ", hash);

        }
    }
}

const listenEvent = async () => {
    try{
        const listenDepositEvent = programL1.addEventListener("depositEvent", async (event, slot, _sig) => {
            const depositIndex = event.depositIndex.toNumber();
            console.log("event slot: ", slot);
            console.log("event eventslot: ", event.slot.toNumber());
            console.log("event label: ", event.label);
            console.log("event depositIndex: ", depositIndex);
            console.log("event leafAccountPubkey: ", event.leafAccountPubkey.toString());
            console.log("event deposit item hash: ", event.depositItemHash.toString());
            console.log("event merkle root: ", event.merkleRoot.toString());
            console.log('event amount:', event.amount.toNumber());
            console.log("event user", event.user.toString());
            
            // store deposit in pg
            await depositService.createDeposit({
                slot: slot,
                deposit_index: depositIndex,
                deposit_amount: event.amount.toNumber(),
                user_addr: event.user.toString(),
                leaf_chunk_pda_addr: event.leafAccountPubkey.toString(),
                current_merkle_root: event.merkleRoot.toString(),
                deposit_item_hash: event.depositItemHash.toString(),
            });
            if (depositIndex != 0 && depositIndex % CHUNK_SIZE === 0){
                //localTree.free();
                localTree = new MerkleTree(HashingAlgorithm.Sha256d, 32);
                console.log("reset merkle tree, reached chunk size ", depositIndex);
            }
            const addrU8Arr = bs58.decode(event.user.toString());
            //console.log("addrU8Arr: ", addrU8Arr.toString());
            const amountByteArr = event.amount.toArray('le', 8);
            const amountUint8Array = new Uint8Array(amountByteArr);
            const totalU8Arr = new Uint8Array(amountUint8Array.length + addrU8Arr.length);
            totalU8Arr.set(amountUint8Array);
            totalU8Arr.set(addrU8Arr, amountUint8Array.length);
            localTree.add_leaf(totalU8Arr);
            localTree.merklize();
            
            //console.log("new root:", localTree.get_merkle_root().toString());
            const proof: MerkleProof = localTree.merkle_proof_index(depositIndex % CHUNK_SIZE);
            //console.log("pairing hashes: ", proof.get_pairing_hashes());
            console.log("pairing hashes length: ", proof.get_pairing_hashes().length);

            // tmp update L2 summary root
            const root = localTree.get_merkle_root();
            console.log("relayer root: ", root);

            const index = new anchor.BN(depositIndex / CHUNK_SIZE);
            const rootPda = anchor.web3.PublicKey.findProgramAddressSync(
            [
                Buffer.from("root"),
                new anchor.web3.PublicKey(L2SUMMARYPUBKEY).toBuffer(),
                index.toArrayLike(Buffer, 'le', 8)
            ],
            programL2.programId
            );

            await programL2.methods.updateMerkleRoot(new anchor.BN(depositIndex), Buffer.from(root))
            .accounts({
                l2Summary: new anchor.web3.PublicKey(L2SUMMARYPUBKEY),
                mint: new anchor.web3.PublicKey(MINTPUBKEY),
                userTokenAccount: new anchor.web3.PublicKey(USERTOKENACCOUNTPUBKEY),
                rootChunk: rootPda[0],
                // @ts-ignore
                tokenProgram: TOKEN_PROGRAM_ID, 
            })
            .rpc();
            const l2summary = programL2.account.l2SummaryAccount.fetch(new anchor.web3.PublicKey(L2SUMMARYPUBKEY));
            //console.log("l2summary: ", [...(await l2summary).merkleRootsContainer]);
            // send to verify
            let proof_hashes = proof.get_pairing_hashes();
            await programL2.methods.verifyMerkleProof(
                new anchor.BN(depositIndex),
                new anchor.BN(event.amount), 
                event.user, 
                Buffer.from(proof_hashes)
            )
            .accounts({
                l2Summary: new anchor.web3.PublicKey(L2SUMMARYPUBKEY),
                mint: new anchor.web3.PublicKey(MINTPUBKEY),
                userTokenAccount: new anchor.web3.PublicKey(USERTOKENACCOUNTPUBKEY),
                rootChunk: rootPda[0],
                // @ts-ignore
                tokenProgram: TOKEN_PROGRAM_ID, 
            })
            .signers([l2Payer.payer])
            .rpc();
    
          });
        
        //await new Promise((resolve) => setTimeout(resolve, 1000*60*5));
        await new Promise(() => {});
        programL1.removeEventListener(listenDepositEvent);
    }catch(error){
        console.log("error: ", error.toString());
    }
}

//listenEvent();

relayerSync();