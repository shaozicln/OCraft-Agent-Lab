import type { NextConfig } from 'next';
import path from 'path';
import { fileURLToPath } from 'url';

const clientDir = path.dirname(fileURLToPath(import.meta.url));
const sharedPackageDir = path.join(clientDir, '../packages/shared');

const nextConfig: NextConfig = {
  transpilePackages: ['@ocraft/shared'],
  // 必须限制在 client 目录，否则 Turbopack 会扫整个 monorepo（含 server/node_modules）导致 OOM
  turbopack: {
    root: clientDir,
    resolveAlias: {
      '@ocraft/shared': '../packages/shared',
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@ocraft/shared': sharedPackageDir,
    };
    return config;
  },
};

export default nextConfig;
