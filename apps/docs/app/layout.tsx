import type { Metadata } from 'next';
import './global.css';
import { Inter } from 'next/font/google';
import { Provider } from '@/components/provider';
import { SITE_ORIGIN } from '@/lib/site';

const inter = Inter({
  subsets: ['latin'],
});

export const metadata: Metadata = {
	metadataBase: new URL(SITE_ORIGIN),
};

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
		<Provider>{children}</Provider>
      </body>
    </html>
  );
}
