import { Analytics } from '@vercel/analytics/next';
import { RootProvider } from 'fumadocs-ui/provider/next';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

import './global.css';

const inter = Inter({
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('http://localhost:3030'),
  title: {
    template: '%s | CInCoders NestJS StarterKit',
    default: 'CInCoders NestJS StarterKit - Documentação',
  },
  description:
    'Documentação técnica e arquitetural do CInCoders NestJS StarterKit com TypeORM, Keycloak e Zod.',
  openGraph: {
    siteName: 'CInCoders NestJS StarterKit Docs',
    type: 'website',
  },
};

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="pt-BR" className={inter.className} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <RootProvider theme={{ enabled: false }}>{children}</RootProvider>
        <Analytics />
      </body>
    </html>
  );
}
