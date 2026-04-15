import type { Metadata } from 'next';
import '../global_styles.css';
import '../index.css';
import '../styles/portal-theme.css';
import { AppProviders } from '@/components/providers/AppProviders';

export const metadata: Metadata = {
  title: 'São Luiz Express — Workspace & Portal',
  description: 'Portal do colaborador, operacional e CRM — São Luiz Express',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [{ url: '/sle-brand-kangaroo.png', type: 'image/png' }],
    apple: [{ url: '/sle-brand-kangaroo.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    title: 'SLE Workspace',
    statusBarStyle: 'default',
  },
  themeColor: '#0a1628',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="min-h-dvh antialiased font-body" data-theme="workspace">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}

