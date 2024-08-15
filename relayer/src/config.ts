// config.ts

import * as dotenv from 'dotenv';

// 加载 .env 文件中的环境变量
dotenv.config();

export const config = {
    l1cluster: process.env.L1CLUSTER,
    l1wallet: process.env.L1WALLET,
};

console.log(config);
