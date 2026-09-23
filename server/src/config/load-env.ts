import { existsSync } from 'fs';
import { resolve } from 'path';
import { config } from 'dotenv';

/**
 * 尽早在任何「模块级表达式」读取 process.env 之前加载 server/.env。
 *
 * 为什么需要单独一个文件：
 * `@WebSocketGateway({ cors: ... })` 这类装饰器参数是在 import 阶段求值的，
 * 而 main.ts 里原本的 config() 调用发生在所有 import 之后 —— 所以那些位置
 * 读不到 .env，只能拿到字面量默认值（历史上就因此把 WS CORS 硬编码错了端口）。
 * 在 main.ts 的第一行 `import './config/load-env';` 即可保证加载顺序。
 *
 * 兼容两种运行布局：
 * - ts-node 直接跑 src/：__dirname = server/src/config
 * - nest build 产物：     __dirname = server/dist/src/config
 */
const candidates = [
  resolve(__dirname, '../../.env'), // src/config -> server/.env
  resolve(__dirname, '../../../.env'), // dist/src/config -> server/.env
  resolve(process.cwd(), '.env'), // cwd = server/
  resolve(process.cwd(), '../.env'), // cwd = 仓库根
];

const found = candidates.find((p) => existsSync(p));
if (found) {
  config({ path: found });
}
