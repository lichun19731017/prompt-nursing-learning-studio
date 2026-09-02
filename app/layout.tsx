import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Prompt 小組共學室',
  description: '教 AI 聽懂你的任務。個人練習、兩人比較、小組整合，讓每一次修改都有依據。',
  robots: { index: false, follow: false },
  openGraph: { title: 'Prompt 小組共學室', description: '個人練習 → 兩人比較 → 小組整合', locale: 'zh_TW', type: 'website' },
  twitter: { card: 'summary_large_image', title: 'Prompt 小組共學室', description: '把問題說清楚，把判斷留給自己。' }
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-Hant"><body>{children}</body></html>;
}

