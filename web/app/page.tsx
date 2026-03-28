import { searchSetups, fetchManifest } from '@/lib/github';
import { BrowseClient } from '@/components/BrowseClient';
import type { ClaudeSetupManifest, GithubRepo } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function BrowsePage() {
  const repos = await searchSetups();

  // Fetch manifests in parallel (cap at 24 to avoid rate limits)
  const manifests: Record<string, ClaudeSetupManifest | null> = {};
  await Promise.all(
    repos.slice(0, 24).map(async (repo: GithubRepo) => {
      manifests[repo.full_name] = await fetchManifest(repo.owner.login, repo.name);
    }),
  );

  return (
    <div className="max-w-6xl mx-auto px-6 py-14">
      {/* Hero */}
      <div className="mb-12 animate-[fadeUp_0.5s_ease-out_both]">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-accent/30 bg-accent/8 mb-5">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          <span className="text-xs font-mono text-accent/90">community registry</span>
        </div>
        <h1 className="font-display font-bold text-4xl sm:text-5xl text-[#ede9e4] leading-tight tracking-tight mb-3">
          discover claude setups
        </h1>
        <p className="text-muted text-base max-w-xl leading-relaxed">
          Browse MCP servers, agents, skills, and configurations shared by the Claude Code community.
          Install any setup in one command.
        </p>

        {/* Quick install hint */}
        <div className="mt-5 flex items-center gap-3">
          <code className="text-xs font-mono bg-surface border border-border px-3 py-1.5 rounded-md text-[#ede9e4]">
            npm install -g claude-pack
          </code>
          <span className="text-muted text-xs">then browse below ↓</span>
        </div>
      </div>

      {/* Browse */}
      <BrowseClient repos={repos} manifests={manifests} />
    </div>
  );
}
