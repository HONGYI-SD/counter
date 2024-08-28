import DepositService from './DepositService';

const run = async () => {
  const depositService = new DepositService();

  // 创建新的存款记录
  const newDeposit = await depositService.createDeposit({
    slot: 2,
    deposit_index: 3,
    deposit_amount: 1000,
    user_addr: '0x123',
    leaf_chunk_pda_addr: '0xabc',
    current_merkle_root: '0xdef',
    deposit_item_hash: '0xghi',
  });
  console.log('New Deposit:', newDeposit);

  // 获取所有存款记录
  const deposits = await depositService.getDeposits();
  console.log('All Deposits:', deposits);

  // 根据 ID 获取单个存款记录
  const deposit = await depositService.getDepositById(newDeposit.id!);
  console.log('Deposit by ID:', deposit);

  const latest = await depositService.getLatestDepositItem();
  console.log("latest : ", latest);
  // 删除存款记录
  //const isDeleted = await depositService.deleteDeposit(newDeposit.id!);
  //console.log('Is Deposit Deleted:', isDeleted);
};

run();
