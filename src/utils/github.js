import { Octokit } from '@octokit/rest';
import { execSync } from 'child_process';

let _token = null;

export function getGhToken() {
  if (_token) return _token;
  try {
    _token = execSync('gh auth token', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    return _token;
  } catch {
    return null;
  }
}

export function getOctokit() {
  const token = getGhToken();
  if (!token) throw new Error('Not authenticated with GitHub. Run: gh auth login');
  return new Octokit({ auth: token });
}

export function getGhUsername() {
  return execSync('gh api user --jq .login', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

/**
 * Search GitHub for claude-pack repos.
 */
export async function searchSetups(query, limit = 10) {
  const octokit = getOctokit();
  const q = query ? `topic:claude-pack ${query}` : 'topic:claude-pack';
  const { data } = await octokit.search.repos({
    q,
    sort: 'stars',
    order: 'desc',
    per_page: limit,
  });
  return data.items;
}

/**
 * Fetch a raw file from a GitHub repo (defaults to main branch).
 * Returns null if the file doesn't exist.
 */
export async function fetchRawFile(owner, repo, path, branch = 'main') {
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
  const token = getGhToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const res = await fetch(url, { headers });
  if (!res.ok) return null;
  return res.text();
}

/**
 * Fetch and parse the claude-setup.json manifest from a repo.
 */
export async function fetchSetupManifest(owner, repo) {
  const content = await fetchRawFile(owner, repo, 'claude-setup.json');
  if (!content) return null;
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * List files in a directory of a GitHub repo via the Contents API.
 * Returns an empty array if the directory doesn't exist.
 */
export async function listDirectory(owner, repo, path) {
  const token = getGhToken();
  if (!token) return [];

  const octokit = new Octokit({ auth: token });
  try {
    const { data } = await octokit.repos.getContent({ owner, repo, path });
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
