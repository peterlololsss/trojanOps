// Owner: D (WP-2). Shared shell and USC fonts.
import type { Metadata } from 'next';
import { AppShell } from '@/components/shell';
import { mono, sans, serif } from './fonts';
import './globals.css';

export const metadata: Metadata = {
  title: 'TrojanOps',
  description: 'Governed agents for USC student clubs.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sans.variable + ' ' + serif.variable + ' ' + mono.variable}>
      <body className="flex min-h-dvh flex-col">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
