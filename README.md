# L1
- l1合约位置 anchor/programs/src/lib.rs
- 合约测试代码 anchor/tests/*
- 监听 更新merkle_root事件的示例代码 
``` ts
const listenerEvent2 = program.addEventListener("depositEvent", async (event, _slot, _sig) => {
        const depositIndex = event.depositIndex.toNumber();
        console.log("event depositIndex: ", depositIndex);
        console.log("event leafAccountPubkey: ", event.leafAccountPubkey.toString());
        console.log("event merkle root: ", event.merkleRoot.toString());
        console.log('event amount:', event.amount.toNumber());
        console.log("event user", event.user.toString());
});
``` 

# L2
- l2合约位置 anchor-L2/programs/src/lib.rs
- 合约测试代码 anchor/tests/*
- 更新L2合约中的root信息，示例代码
```ts
await program.methods.updateLeafpdaMerkleRoot(Buffer.from(root), new BN(depositIndex-1))
      .accounts({l2Summary: summaryKeypair.publicKey})
      .rpc();
```
- L2验证leaf proof示例代码
```ts
await program.methods.verifyMerkleProof(new BN(depositAmount), randomIndex, payer.publicKey, Buffer.from(proof_hashes))
      .accounts({l2Summary: summaryKeypair.publicKey})
      .rpc();
```