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
  "[123,128,56,215,195,160,45,93,135,81,37,236,51,217,212,210,190,188,77,77,135,224,157,87,239,66,194,38,209,243,138,25,156,243,247,66,6,125,50,126,183,190,15,206,215,41,125,179,44,9,128,32,234,34,165,216,131,15,89,127,48,137,137,167]"
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
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // const summary = await program.account.summaryAccount.fetch(summaryKeypair.publicKey);
    // const leafPda = anchor.web3.PublicKey.findProgramAddressSync(
    // [
    // Buffer.from("leaf"),
    // summaryKeypair.publicKey.toBuffer(),
    // new BN(0).toArrayLike(Buffer, 'le', 8)
    // ],
    // program.programId
    // );
    // console.log("comput pda1 str: ", leafPda[0].toString());
    // console.log("comput pda1: ", leafPda[0].toBytes());
    // let pda1 = summary.leafChunkAccounts.slice(0, 32);
    // console.log("pda1: ", pda1.toString());

  });

});

async function view(program: Program<CounterAnchor>, summaryKeypair: Keypair, programWallet: Keypair, payer: anchor.Wallet, depositAmount: number, depositIndex: number) {
  //const summary = await program.account.summaryAccount.fetch(summaryKeypair.publicKey);
  //const chunkCount = summary.leafChunkCount;
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
    const prefix = 'Program return: ';
    let log = simulateResponse.raw.find((log) => log.startsWith(prefix));
    log = log.slice(prefix.length);
    const [_, data] = log.split(' ', 2);
    console.log("data:", data);
    const buffer = Buffer.from(data, 'base64');
    const decimalArray = Array.from(buffer).map(byte => byte.toString(10));
    console.log('decimalArray', decimalArray);
}

