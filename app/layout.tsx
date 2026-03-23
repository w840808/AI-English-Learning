import type { Metadata } from 'next';
import { Inter, Merriweather } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
// 針對英文長文閱讀的最佳化字體
const merriweather = Merriweather({ 
  weight: ['300', '400', '700'], 
  subsets: ['latin'], 
  variable: '--font-merriweather' 
});

export const metadata: Metadata = {
  title: 'AI English Learning Radio',
  description: 'A modern, interactive English learning tool powered by AI',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW" suppressHydrationWarning>
      <body className={`${inter.variable} ${merriweather.variable} antialiased min-h-screen bg-stone-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 transition-colors duration-300`}>
        {/* 未來可在此處包裝 <ThemeProvider> 實作 Dark Mode */}
        {children}
      </body>
    </html>
  );
}
