import type { Metadata } from 'next';
import '../global_styles.css';
import '../index.css';

export const metadata: Metadata = {
  title: 'São Luiz Express - Pendências',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'SLE Pendências',
    statusBarStyle: 'default',
  },
  themeColor: '#2c348c',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}

