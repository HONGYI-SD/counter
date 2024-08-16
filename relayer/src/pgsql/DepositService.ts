import pool from './db';

interface Deposit {
  id?: number;
  deposit_index: number;
  deposit_amount: number;
  user_addr: string | null;
  leaf_chunk_pda_addr: string | null;
  current_merkle_root: string | null;
}

class DepositService {
  // 创建新的存款记录
  async createDeposit(deposit: Deposit): Promise<Deposit> {
    const { deposit_index, deposit_amount, user_addr, leaf_chunk_pda_addr, current_merkle_root } = deposit;
    const result = await pool.query(
      'INSERT INTO public.deposit (deposit_index, deposit_amount, user_addr, leaf_chunk_pda_addr, current_merkle_root) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [deposit_index, deposit_amount, user_addr, leaf_chunk_pda_addr, current_merkle_root]
    );
    return result.rows[0];
  }

  // 获取所有存款记录
  async getDeposits(): Promise<Deposit[]> {
    const result = await pool.query('SELECT * FROM public.deposit');
    return result.rows;
  }

  // 根据 ID 获取单个存款记录
  async getDepositById(id: number): Promise<Deposit | null> {
    const result = await pool.query('SELECT * FROM public.deposit WHERE id = $1', [id]);
    if (result.rows.length) {
      return result.rows[0];
    }
    return null;
  }

  // 更新存款记录
  async updateDeposit(id: number, deposit: Deposit): Promise<Deposit | null> {
    const { deposit_index, deposit_amount, user_addr, leaf_chunk_pda_addr, current_merkle_root } = deposit;
    const result = await pool.query(
      'UPDATE public.deposit SET deposit_index = $1, deposit_amount = $2, user_addr = $3, leaf_chunk_pda_addr = $4, current_merkle_root = $5 WHERE id = $6 RETURNING *',
      [deposit_index, deposit_amount, user_addr, leaf_chunk_pda_addr, current_merkle_root, id]
    );
    if (result.rows.length) {
      return result.rows[0];
    }
    return null;
  }

  // 删除存款记录
  async deleteDeposit(id: number): Promise<boolean> {
    const result = await pool.query('DELETE FROM public.deposit WHERE id = $1 RETURNING *', [id]);
    return result.rows.length > 0;
  }
}

export default DepositService;
