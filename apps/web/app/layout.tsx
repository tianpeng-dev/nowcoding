import { getEnv } from '@/lib/env';
import { resolvePublicOrigin } from '@/lib/setup-status';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

const env = getEnv();
const siteUrl = resolvePublicOrigin({
  websiteUrl: env.NOWCODING_WEBSITE_URL,
  vercelProjectProductionUrl: process.env.VERCEL_PROJECT_PRODUCTION_URL,
  vercelUrl: process.env.VERCEL_URL,
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'NowCoding',
  description:
    'Public NowCoding profile with live coding activity, token totals, streaks, and tools.',
  openGraph: {
    title: 'NowCoding public profile',
    description:
      'Live coding activity, token totals, streaks, and tools from a public NowCoding profile.',
    images: ['/og/profile.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NowCoding public profile',
    description:
      'Live coding activity, token totals, streaks, and tools from a public NowCoding profile.',
    images: ['/og/profile.png'],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
