import pool from './db';

interface Deposit {
  id?: number;
  slot?: number;
  deposit_index: number;
  user_addr: string | null;
  deposit_amount: number;
  leaf_chunk_pda_addr?: string | null;
  current_merkle_root?: string | null;
  deposit_item_hash: string | null;
}

class DepositService {
  // 创建新的存款记录
  async createDeposit(deposit: Deposit): Promise<Deposit> {
    const { slot, deposit_index, user_addr, deposit_amount, leaf_chunk_pda_addr, current_merkle_root, deposit_item_hash } = deposit;
    const result = await pool.query(
      'INSERT INTO deposit (slot, deposit_index, user_addr, deposit_amount, leaf_chunk_pda_addr, current_merkle_root, deposit_item_hash) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [slot, deposit_index, user_addr, deposit_amount, leaf_chunk_pda_addr, current_merkle_root, deposit_item_hash]
    );
    return result.rows[0];
  }

  async range(start: number, end: number): Promise<Deposit[]> {
    const result = await pool.query(
      'SELECT * FROM deposit WHERE deposit_index >=$1 AND deposit_index <= $2 ORDER BY deposit_index ASC',
      [start, end]
    );
    return result.rows;
  }
  
  // 获取所有存款记录
  async getDeposits(): Promise<Deposit[]> {
    const result = await pool.query('SELECT * FROM deposit');
    return result.rows;
  }

  // 根据 ID 获取单个存款记录
  async getDepositById(id: number): Promise<Deposit | null> {
    const result = await pool.query('SELECT * FROM deposit WHERE id = $1', [id]);
    if (result.rows.length) {
      return result.rows[0];
    }
    return null;
  }

  // get latest deposit item
  async getLatestDepositItem(): Promise<number | null> {
    const result = await pool.query('SELECT MAX(deposit_index) FROM deposit');
    if (result.rows.length){
      return result.rows[0].max;
    }
    return null;
  }
  // 更新存款记录
  async updateDeposit(id: number, deposit: Deposit): Promise<Deposit | null> {
    const { deposit_index, deposit_amount, user_addr, leaf_chunk_pda_addr, current_merkle_root } = deposit;
    const result = await pool.query(
      'UPDATE deposit SET deposit_index = $1, deposit_amount = $2, user_addr = $3, leaf_chunk_pda_addr = $4, current_merkle_root = $5 WHERE id = $6 RETURNING *',
      [deposit_index, deposit_amount, user_addr, leaf_chunk_pda_addr, current_merkle_root, id]
    );
    if (result.rows.length) {
      return result.rows[0];
    }
    return null;
  }

  // 删除存款记录
  async deleteDeposit(id: number): Promise<boolean> {
    const result = await pool.query('DELETE FROM deposit WHERE id = $1 RETURNING *', [id]);
    return result.rows.length > 0;
  }
}

export default DepositService;
