import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@nowcoding/core', '@nowcoding/db', '@nowcoding/badge'],
  typedRoutes: true,
};

export default config;
