# 待办事项

## L1 合约
- 1.1 deposit操作，转账到合约地址
- 1.2 提供merkle root 查询接口
- 1.3 merkle tree 动态扩容

## offchain relayer
- 2.1 链下 merkle tree持久化存储
- 2.2 链下 tree 恢复

## L2 合约
- 3.1 proof验证通过后，发放新的SPL TOKEN

## solana node
- 4.1 搭建独立出块节点的生产环境
- 4.2 node 同步L1合约的merkle root
- 4.3 node 重置后，可以通过1.2接口获得以前的merkle root, 以保证先前的交易可以被执行。