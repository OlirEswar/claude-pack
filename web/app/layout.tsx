import type { Metadata } from 'next';
import { Syne, Instrument_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const syne = Syne({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-syne',
});

const instrument = Instrument_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-instrument',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'cc-config — discover Claude Code setups',
  description: 'Browse and share MCP servers, agents, skills, and Claude Code configurations.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${syne.variable} ${instrument.variable} ${mono.variable}`}>
      <body className="font-sans">
        <header className="relative z-10 border-b border-border">
          <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
            <a href="/" className="flex items-center group">
              <span className="font-display font-bold text-[16px] tracking-tight text-[#ede9e4] group-hover:text-accent transition-colors">
                cc-config
              </span>
            </a>
            <a
              href="https://github.com/OlirEswar/claude-pack"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted hover:text-[#ede9e4] transition-colors text-sm font-mono"
            >
              github ↗
            </a>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
