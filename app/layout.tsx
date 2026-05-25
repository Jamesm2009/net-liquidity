import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Fed Net Liquidity Monitor',
  description: 'Track Fed Net Liquidity vs S&P 500 — Fed Assets minus TGA minus Reverse Repo',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#060a12] antialiased">{children}</body>
    </html>
  );
}
