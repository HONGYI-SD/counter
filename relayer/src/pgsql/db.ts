import { Pool } from 'pg';

const pool = new Pool({
  user: 'postgres',      // 替换为你的数据库用户名
  host: 'localhost',          // 数据库地址
  database: 'postgres',  // 替换为你的数据库名称
  password: '1111',  // 替换为你的数据库密码
  port: 5432,                 // 数据库端口
});

export default pool;
