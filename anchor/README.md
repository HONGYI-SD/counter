# solana L2 simple bridge
## L1
- 记录 deposit 操作
- 用户扣款 
- 更新 merkle root, leafs
- msg
## offchain
- 监听链上 msg， 维护本地 merkle tree
- 针对每一次监听到的 deposit msg， 生成 proof
- 提交本次 deposit、 proof 到 L2
## L2
- 从 L1 同步 merkle root (这一步后面做……)
- 验证 proof 正确性
- 验证通过，mint SPL token