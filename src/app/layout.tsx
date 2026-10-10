import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: '採用管理 | イトーメディカルケア', robots: { index: false, follow: false } };
export default function Layout({ children }: { children: React.ReactNode }) { return <html lang="ja"><body>{children}</body></html>; }
