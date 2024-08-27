import * as anchor from '@coral-xyz/anchor';
import type { Program } from '@coral-xyz/anchor';
import { Keypair } from '@solana/web3.js';
import type { CounterAnchor } from '../target/types/counter_anchor';
import BN from 'bn.js';
import bs58 from 'bs58';
import { HashingAlgorithm, MerkleTree, MerkleProof } from '../../../svm-merkle-tree/dist/node/svm_merkle_tree'
import { AccountLayout, createInitializeAccountInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token';

const CHUNK_SIZE = 10;
describe('counter_anchor', () => {
    // Configure the client to use the local cluster.
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    const admin = provider.wallet as anchor.Wallet;
    const program = anchor.workspace.CounterAnchor as Program<CounterAnchor>;
    console.log("program id:", program.programId.toString())

    const summarySecretKeyString =
        "[240,39,34,110,92,48,91,176,86,44,68,188,107,20,10,232,98,72,1,197,52,50,92,202,98,181,232,184,151,104,103,118,124,98,15,8,116,126,113,149,200,57,13,115,186,234,96,208,88,209,206,177,22,52,84,143,158,183,122,173,207,88,55,7]"
    const summaryKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(summarySecretKeyString)))
    console.log("merkle tree account pubkey:", summaryKeypair.publicKey.toString())

    const mintSecretKeyString =
        "[221,83,189,88,127,142,80,195,73,161,101,68,107,225,84,116,27,196,227,0,191,181,140,198,110,120,69,225,196,23,164,237,193,100,78,75,69,113,155,138,146,14,210,238,50,220,143,121,46,242,49,135,102,69,69,62,147,238,184,44,226,223,155,254]"
    const mint = Keypair.fromSecretKey(new Uint8Array(JSON.parse(mintSecretKeyString)));
    const userTokenAccount = anchor.web3.Keypair.generate();
    console.log("userTokenAccount: ", userTokenAccount.publicKey.toString());
    let localTree = new MerkleTree(HashingAlgorithm.Sha256d, 32);

    it('Increment Counter', async () => {
        try {
            const userTokenAccountRent = await provider.connection.getMinimumBalanceForRentExemption(AccountLayout.span);
            const createUserTokenAccountIx = anchor.web3.SystemProgram.createAccount({
                fromPubkey: admin.publicKey,
                newAccountPubkey: userTokenAccount.publicKey,
                lamports: userTokenAccountRent,
                space: AccountLayout.span,
                programId: TOKEN_PROGRAM_ID,
            });
            const initUserTokenAccountIx = createInitializeAccountInstruction(
                userTokenAccount.publicKey,
                mint.publicKey,
                admin.publicKey,
                TOKEN_PROGRAM_ID
            );
            const tx = new anchor.web3.Transaction()
                .add(createUserTokenAccountIx)
                .add(initUserTokenAccountIx);
            await provider.sendAndConfirm(tx, [admin.payer, userTokenAccount], { commitment: 'confirmed' });

            let depositIndex = 0;
            const depositUserU8Arr = bs58.decode(admin.publicKey.toString());
            const amountByteArr = new BN(10).toArray('le', 8);
            const amountUint8Array = new Uint8Array(amountByteArr);
            const depositItem = new Uint8Array(amountUint8Array.length + depositUserU8Arr.length);
            depositItem.set(amountUint8Array);
            depositItem.set(depositUserU8Arr, amountUint8Array.length);
            localTree.add_leaf(depositItem);
            localTree.merklize();
            let root = localTree.get_merkle_root();
            console.log("client root:", root.toString());
            console.log("depositIndex: ", depositIndex);
            const index = new anchor.BN(depositIndex / CHUNK_SIZE);
            const rootPda = anchor.web3.PublicKey.findProgramAddressSync(
                [
                    Buffer.from("root"),
                    summaryKeypair.publicKey.toBuffer(),
                    index.toArrayLike(Buffer, 'le', 8)
                ],
                program.programId
            );
            console.log("rootpda: ", rootPda[0].toString());
            await program.methods.updateMerkleRoot(new anchor.BN(depositIndex), Buffer.from(root))
                .accounts({
                    l2Summary: summaryKeypair.publicKey,
                    mint: mint.publicKey,
                    userTokenAccount: userTokenAccount.publicKey,
                    rootChunk: rootPda[0],
                    // @ts-ignore
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .rpc();

            console.log("update proof end");

            const proof: MerkleProof = localTree.merkle_proof_index(depositIndex % CHUNK_SIZE);
            let proof_hashes = proof.get_pairing_hashes();
            const depositAmount = 10 * depositIndex;

            // first verify
            await program.methods.verifyMerkleProof(
                new anchor.BN(depositIndex), // depositIndex
                new BN(10),
                admin.publicKey,
                Buffer.from(proof_hashes)
            )
                .accounts({
                    l2Summary: summaryKeypair.publicKey,
                    mint: mint.publicKey,
                    userTokenAccount: userTokenAccount.publicKey,
                    rootChunk: rootPda[0],
                    // @ts-ignore
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .signers([admin.payer])
                .rpc();

            // second verify
            await program.methods.verifyMerkleProof(
                new anchor.BN(depositIndex), // depositIndex
                new BN(10),
                admin.publicKey,
                Buffer.from(proof_hashes)
            )
            .accounts({
                l2Summary: summaryKeypair.publicKey,
                mint: mint.publicKey,
                userTokenAccount: userTokenAccount.publicKey,
                rootChunk: rootPda[0],
                // @ts-ignore
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([admin.payer])
            .rpc();
        } catch (error) {
            console.log('error:', error.toString())
        }
    });
});
