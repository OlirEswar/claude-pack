import type { GithubRepo, ClaudeSetupManifest } from './types';

const API = 'https://api.github.com';
const RAW = 'https://raw.githubusercontent.com';

function headers(): HeadersInit {
  return {
    Accept: 'application/vnd.github.v3+json',
    ...(process.env.GITHUB_TOKEN
      ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
      : {}),
  };
}

export async function searchSetups(query?: string): Promise<GithubRepo[]> {
  const q = query ? `topic:cc-config ${query}` : 'topic:cc-config';
  try {
    const res = await fetch(
      `${API}/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=50`,
      { headers: headers(), cache: 'no-store' },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.items ?? [];
  } catch {
    return [];
  }
}

export async function getRepo(owner: string, repo: string): Promise<GithubRepo | null> {
  try {
    const res = await fetch(`${API}/repos/${owner}/${repo}`, {
      headers: headers(),
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function fetchManifest(
  owner: string,
  repo: string,
): Promise<ClaudeSetupManifest | null> {
  try {
    const res = await fetch(`${RAW}/${owner}/${repo}/main/claude-setup.json`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function fetchClaudeMd(owner: string, repo: string): Promise<string | null> {
  try {
    const res = await fetch(`${RAW}/${owner}/${repo}/main/CLAUDE.md`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return res.text();
  } catch {
    return null;
  }
}
