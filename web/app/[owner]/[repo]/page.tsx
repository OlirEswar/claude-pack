import { notFound } from 'next/navigation';
import Image from 'next/image';
import { getRepo, fetchManifest, fetchClaudeMd } from '@/lib/github';
import { InstallCommand } from '@/components/InstallCommand';
import type { McpServerConfig } from '@/lib/types';

export const revalidate = 300;

interface Props {
  params: { owner: string; repo: string };
}

export async function generateMetadata({ params }: Props) {
  const repo = await getRepo(params.owner, params.repo);
  if (!repo) return { title: 'Setup not found' };
  return {
    title: `${repo.full_name} — claude-pack`,
    description: repo.description ?? undefined,
  };
}

export default async function SetupPage({ params }: Props) {
  const { owner, repo: repoName } = params;

  const [repo, manifest, claudeMd] = await Promise.all([
    getRepo(owner, repoName),
    fetchManifest(owner, repoName),
    fetchClaudeMd(owner, repoName),
  ]);

  if (!repo) notFound();

  const mcpEntries = Object.entries(manifest?.mcpServers ?? {});
  const agents = manifest?.agents ?? [];
  const skills = manifest?.skills ?? [];

  return (
    <div className="max-w-3xl mx-auto px-6 py-12 animate-[fadeUp_0.4s_ease-out_both]">
      {/* Back */}
      <a href="/" className="inline-flex items-center gap-1.5 text-muted hover:text-[#ede9e4] transition-colors text-sm font-mono mb-8 group">
        <span className="group-hover:-translate-x-0.5 transition-transform">←</span> browse all
      </a>

      {/* Header */}
      <div className="flex items-start gap-4 mb-8">
        <Image
          src={repo.owner.avatar_url}
          alt={owner}
          width={48}
          height={48}
          className="rounded-xl shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-mono text-muted mb-0.5">{owner}</p>
          <h1 className="font-display font-bold text-2xl text-[#ede9e4] tracking-tight">
            {repoName}
          </h1>
          {repo.description && (
            <p className="text-muted text-sm mt-1.5 leading-relaxed">{repo.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1 text-muted text-sm font-mono shrink-0">
          <StarIcon />
          {repo.stargazers_count}
        </div>
      </div>

      {/* Install */}
      <section className="mb-8">
        <SectionLabel>install</SectionLabel>
        <InstallCommand repo={`${owner}/${repoName}`} />
        <p className="text-xs text-muted mt-2 font-mono">
          requires{' '}
          <a href="https://github.com/OlirEswar/claude-pack" className="text-accent hover:underline" target="_blank" rel="noopener noreferrer">
            claude-pack
          </a>
        </p>
      </section>

      {/* MCP Servers */}
      {mcpEntries.length > 0 && (
        <section className="mb-8">
          <SectionLabel>mcp servers ({mcpEntries.length})</SectionLabel>
          <div className="space-y-2">
            {mcpEntries.map(([name, config]) => (
              <McpServerRow key={name} name={name} config={config} />
            ))}
          </div>
        </section>
      )}

      {/* Agents + Skills */}
      {(agents.length > 0 || skills.length > 0) && (
        <div className="grid grid-cols-2 gap-6 mb-8">
          {agents.length > 0 && (
            <section>
              <SectionLabel>agents ({agents.length})</SectionLabel>
              <ul className="space-y-1.5">
                {agents.map((name) => (
                  <li key={name} className="text-sm font-mono text-muted bg-surface border border-border rounded-md px-3 py-2">
                    {name.replace('.md', '')}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {skills.length > 0 && (
            <section>
              <SectionLabel>skills ({skills.length})</SectionLabel>
              <ul className="space-y-1.5">
                {skills.map((name) => (
                  <li key={name} className="text-sm font-mono text-muted bg-surface border border-border rounded-md px-3 py-2">
                    {name.replace('.md', '')}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {/* CLAUDE.md */}
      {claudeMd && (
        <section className="mb-8">
          <SectionLabel>CLAUDE.md</SectionLabel>
          <div className="bg-surface border border-border rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-raised">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
              <span className="ml-2 text-xs font-mono text-muted">CLAUDE.md</span>
            </div>
            <pre className="p-4 text-xs font-mono text-muted leading-relaxed overflow-x-auto whitespace-pre-wrap max-h-72 overflow-y-auto">
              {claudeMd}
            </pre>
          </div>
        </section>
      )}

      {/* View on GitHub */}
      <a
        href={repo.html_url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-sm font-mono text-muted hover:text-[#ede9e4] transition-colors border border-border hover:border-[#ede9e4]/20 rounded-lg px-4 py-2"
      >
        view on github ↗
      </a>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-mono text-accent/80 uppercase tracking-widest mb-3">
      {children}
    </h2>
  );
}

function McpServerRow({ name, config }: { name: string; config: McpServerConfig }) {
  const isHttp = config.type === 'http' || config.type === 'sse';
  const command = config.command
    ? [config.command, ...(config.args ?? [])].join(' ')
    : config.url ?? '';

  return (
    <div className="bg-surface border border-border rounded-lg px-4 py-3">
      <div className="flex items-center justify-between gap-3 mb-1">
        <span className="font-mono text-sm text-[#ede9e4]">{name}</span>
        <span className={`badge ${isHttp ? 'badge-amber' : 'badge-green'}`}>
          {isHttp ? '⚠ auth required' : '✓ ready'}
        </span>
      </div>
      {command && (
        <p className="text-xs font-mono text-muted truncate">{command}</p>
      )}
    </div>
  );
}

function StarIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 12 12" fill="currentColor">
      <path d="M6 1l1.4 3h3l-2.5 1.8.9 3L6 7 3.2 8.8l.9-3L1.6 4h3z" />
    </svg>
  );
}
