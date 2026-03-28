'use client';

import { useState } from 'react';

export function InstallCommand({ repo }: { repo: string }) {
  const [copied, setCopied] = useState(false);
  const command = `claude-pack install ${repo}`;

  async function copy() {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center gap-2 bg-[#0d0c0f] border border-border rounded-lg px-4 py-3 group">
      <span className="text-accent font-mono text-sm select-none">$</span>
      <code className="font-mono text-sm text-[#ede9e4] flex-1 truncate">{command}</code>
      <button
        onClick={copy}
        className="ml-2 shrink-0 px-2.5 py-1 rounded text-xs font-mono transition-all duration-150
          border border-border text-muted hover:border-accent hover:text-accent"
      >
        {copied ? 'copied!' : 'copy'}
      </button>
    </div>
  );
}
