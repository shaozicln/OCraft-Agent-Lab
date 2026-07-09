import { config } from 'dotenv';
import { resolve } from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

// 从 server/.env 加载环境变量（dev 与 prod 均相对于编译输出目录定位）
config({ path: resolve(__dirname, '../.env') });

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 开发环境允许任意前端 origin（含局域网 IP 访问）；生产用 CLIENT_ORIGIN 白名单
  const isDev = process.env.NODE_ENV !== 'production';
  app.enableCors({
    origin: isDev
      ? true
      : (process.env.CLIENT_ORIGIN?.split(',').map((s) => s.trim()) ?? [
          'http://localhost:3000',
        ]),
    credentials: true,
  });

  const port = process.env.PORT ?? 3010;
  await app.listen(port);
  console.log(`Game server listening on http://localhost:${port}`);
}
bootstrap();
