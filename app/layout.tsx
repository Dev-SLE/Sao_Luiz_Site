import type { Metadata } from 'next';
import '../global_styles.css';
import '../index.css';

export const metadata: Metadata = {
  title: 'São Luiz Express - Pendências',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}

