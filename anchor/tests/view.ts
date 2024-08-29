import * as anchor from '@coral-xyz/anchor';
import type { Program } from '@coral-xyz/anchor';
import { Keypair, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import type { CounterAnchor } from '../target/types/counter_anchor';
import BN from 'bn.js';
import { HashingAlgorithm, MerkleTree } from '../../../svm-merkle-tree/dist/node/svm_merkle_tree'
import { bs58 } from '@coral-xyz/anchor/dist/cjs/utils/bytes';
import { unpack } from '@solana/spl-token-metadata';

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

    for (let i = 0; i < 14; i++) {
        await view(program, summaryKeypair, programWallet, payer, 2000, i);
        //await new Promise((resolve) => setTimeout(resolve, 1000));
    }

  });

});

async function view(program: Program<CounterAnchor>, summaryKeypair: Keypair, programWallet: Keypair, payer: anchor.Wallet, depositAmount: number, depositIndex: number) {
  const leafPda = anchor.web3.PublicKey.findProgramAddressSync(
    [
    Buffer.from("leaf"),
    summaryKeypair.publicKey.toBuffer(),
    new anchor.BN(depositIndex / CHUNK_SIZE).toArrayLike(Buffer, 'le', 8)
  ],
    program.programId
  );
  
  console.log("leaf pda: ", leafPda[0].toString());
  const simulateResponse = await program.methods.viewDepositItem(new BN(depositIndex))
    .accounts({ 
        user: payer.publicKey, 
        summary: summaryKeypair.publicKey, 
        leafChunk: leafPda[0],
    })
    .simulate();

    const [index, user, amount, hash] = parselog([...simulateResponse.raw]);
    console.log("", index, "", user, " ", amount, " ", hash);
    
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