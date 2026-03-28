'use client';

import { useState, useMemo } from 'react';
import { SetupCard } from './SetupCard';
import type { GithubRepo, ClaudeSetupManifest } from '@/lib/types';

interface Props {
  repos: GithubRepo[];
  manifests: Record<string, ClaudeSetupManifest | null>;
}

export function BrowseClient({ repos, manifests }: Props) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) return repos;
    const q = query.toLowerCase();
    return repos.filter(
      (r) =>
        r.full_name.toLowerCase().includes(q) ||
        (r.description ?? '').toLowerCase().includes(q) ||
        r.topics.some((t) => t.includes(q)),
    );
  }, [repos, query]);

  return (
    <div>
      {/* Search */}
      <div className="relative mb-10">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted">
          <SearchIcon />
        </div>
        <input
          type="text"
          placeholder="Search setups, MCP servers, authors..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-surface border border-border rounded-lg pl-10 pr-4 py-3
            text-sm font-sans text-[#ede9e4] placeholder:text-muted
            focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30
            transition-all duration-200"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-[#ede9e4] transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between mb-5">
        <p className="text-xs font-mono text-muted">
          {filtered.length} setup{filtered.length !== 1 ? 's' : ''}
          {query && <span className="text-accent"> matching &ldquo;{query}&rdquo;</span>}
        </p>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-muted">
          <p className="font-mono text-sm">no setups found</p>
          <p className="text-xs mt-2">try a different search term</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((repo, i) => (
            <SetupCard
              key={repo.id}
              repo={repo}
              manifest={manifests[repo.full_name]}
              index={i}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="6.5" cy="6.5" r="5" />
      <path d="M10.5 10.5l3.5 3.5" strokeLinecap="round" />
    </svg>
  );
}
