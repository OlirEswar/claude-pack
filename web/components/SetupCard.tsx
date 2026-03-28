import Image from 'next/image';
import type { GithubRepo, ClaudeSetupManifest } from '@/lib/types';

interface Props {
  repo: GithubRepo;
  manifest?: ClaudeSetupManifest | null;
  index?: number;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export function SetupCard({ repo, manifest, index = 0 }: Props) {
  const mcpEntries = Object.entries(manifest?.mcpServers ?? {});
  const agentCount = manifest?.agents?.length ?? 0;
  const skillCount = manifest?.skills?.length ?? 0;
  const staggerClass = `stagger-${Math.min((index % 6) + 1, 6)}`;

  return (
    <a
      href={`/${repo.owner.login}/${repo.name}`}
      className={`card block p-5 ${staggerClass}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Image
            src={repo.owner.avatar_url}
            alt={repo.owner.login}
            width={24}
            height={24}
            className="rounded-full shrink-0 opacity-80"
          />
          <div className="min-w-0">
            <p className="text-[11px] text-muted font-mono truncate">{repo.owner.login}</p>
            <h3 className="font-display font-semibold text-[15px] text-[#ede9e4] leading-tight truncate">
              {repo.name}
            </h3>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0 text-muted text-xs font-mono">
          <StarIcon />
          {repo.stargazers_count}
        </div>
      </div>

      {/* Description */}
      {repo.description && (
        <p className="text-sm text-muted leading-snug mb-4 line-clamp-2">
          {repo.description}
        </p>
      )}

      {/* Stats row */}
      <div className="flex items-center gap-2 flex-wrap">
        {mcpEntries.length > 0 && (
          <span className="badge badge-blue">
            <ServerIcon /> {mcpEntries.length} mcp
          </span>
        )}
        {agentCount > 0 && (
          <span className="badge badge-muted">
            {agentCount} agent{agentCount !== 1 ? 's' : ''}
          </span>
        )}
        {skillCount > 0 && (
          <span className="badge badge-muted">
            {skillCount} skill{skillCount !== 1 ? 's' : ''}
          </span>
        )}
        <span className="badge badge-muted ml-auto">{timeAgo(repo.pushed_at)}</span>
      </div>
    </a>
  );
}

function StarIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor">
      <path d="M6 1l1.4 3h3l-2.5 1.8.9 3L6 7 3.2 8.8l.9-3L1.6 4h3z" />
    </svg>
  );
}

function ServerIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="1" width="10" height="4" rx="1" />
      <rect x="1" y="7" width="10" height="4" rx="1" />
    </svg>
  );
}
