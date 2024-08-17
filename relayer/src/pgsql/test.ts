import DepositService from './DepositService';

const run = async () => {
  const depositService = new DepositService();

  // 创建新的存款记录
  const newDeposit = await depositService.createDeposit({
    deposit_index: 1,
    deposit_amount: 1000,
    user_addr: '0x123',
    leaf_chunk_pda_addr: '0xabc',
    current_merkle_root: '0xdef'
  });
  console.log('New Deposit:', newDeposit);

  // 获取所有存款记录
  const deposits = await depositService.getDeposits();
  console.log('All Deposits:', deposits);

  // 根据 ID 获取单个存款记录
  const deposit = await depositService.getDepositById(newDeposit.id!);
  console.log('Deposit by ID:', deposit);

  // 更新存款记录
  const updatedDeposit = await depositService.updateDeposit(newDeposit.id!, {
    deposit_index: 2,
    deposit_amount: 2000,
    user_addr: '0x456',
    leaf_chunk_pda_addr: '0xdef',
    current_merkle_root: '0xghi'
  });
  console.log('Updated Deposit:', updatedDeposit);

  // 删除存款记录
  //const isDeleted = await depositService.deleteDeposit(newDeposit.id!);
  //console.log('Is Deposit Deleted:', isDeleted);
};

run();
