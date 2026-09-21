import type { Metadata } from 'next';
import { Suspense } from 'react';
import Header from '@/components/Header';
import { todayIST } from '@/lib/asof';
import './globals.css';

export const metadata: Metadata = {
  title: 'AR Manager · Brightwater Advisory',
  description: 'Accounts receivable: customers, invoices, ageing, payments and statements.',
};

// Every page reads ?asof= and live data, so nothing is prerendered.
export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased print:bg-white">
        <Suspense fallback={<div className="h-14 border-b bg-white" />}>
          <Header today={todayIST()} />
        </Suspense>
        <main className="mx-auto max-w-7xl px-4 py-6 print:max-w-none print:p-0">{children}</main>
      </body>
    </html>
  );
}
