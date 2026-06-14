import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@nowcoding/core', '@nowcoding/db', '@nowcoding/badge'],
  typedRoutes: true,
};

export default withNextIntl(config);
