import type { NextConfig } from 'next';
import path from 'path';
import { fileURLToPath } from 'url';

const clientDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  transpilePackages: ['@ocraft/shared'],
  // 避免 Turbopack 把 monorepo 根目录当 workspace，扫 server/node_modules 导致 OOM
  turbopack: {
    root: clientDir,
  },
};

export default nextConfig;
