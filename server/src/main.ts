// 必须放在最前：在任何模块级表达式读取 process.env 之前加载 server/.env
import './config/load-env';
import { config } from 'dotenv';
import { resolve } from 'path';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  assertServerEnv,
  bindHost,
  clientOrigins,
  isLoopbackOnly,
} from './config/env';

// 兜底：load-env 未命中时仍按原路径加载（dotenv 默认不覆盖已有变量，重复调用安全）
// 编译后在 dist/src/main.js，需上溯两级到 server/.env
config({ path: resolve(__dirname, '../../.env') });

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // 启动自检：AUTH_SECRET 缺失或仍是占位符 -> 直接拒绝启动
  for (const warning of assertServerEnv()) {
    logger.warn(warning);
  }

  const app = await NestFactory.create(AppModule);

  // CORS：只有显式 NODE_ENV=development 才反射任意 origin，其余一律走 CLIENT_ORIGIN 白名单。
  // 注意不要写成 `NODE_ENV !== 'production'` —— 未设置 NODE_ENV 时会被误判成开发环境而全放开。
  const isDev = process.env.NODE_ENV === 'development';
  const origins = clientOrigins();
  app.enableCors({
    origin: isDev ? true : origins,
    credentials: true,
  });

  const port = process.env.PORT ?? 4000;
  const host = bindHost();
  await app.listen(port, host);

  if (isLoopbackOnly()) {
    logger.log(
      `Game server listening on http://localhost:${port}（仅本机可访问）`,
    );
  } else {
    logger.warn(
      `Game server listening on http://${host}:${port} —— 已对网络开放，` +
        '请确认 BIND_HOST / PACK_ADMIN_IDS / 系统防火墙均已收紧',
    );
    logger.log(`允许的前端来源：${origins.join(', ')}`);
  }
}

bootstrap().catch((err: unknown) => {
  console.error(
    `[ocraft-server] 启动失败：${err instanceof Error ? err.message : String(err)}`,
  );
  process.exit(1);
});
