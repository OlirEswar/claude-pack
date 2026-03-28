export interface McpServerConfig {
  type?: 'stdio' | 'http' | 'sse';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
}

export interface ClaudeSetupManifest {
  name?: string;
  version?: string;
  description?: string;
  mcpServers?: Record<string, McpServerConfig>;
  agents?: string[];
  skills?: string[];
}

export interface GithubRepo {
  id: number;
  full_name: string;
  name: string;
  description: string | null;
  stargazers_count: number;
  owner: { login: string; avatar_url: string };
  topics: string[];
  updated_at: string;
  html_url: string;
  pushed_at: string;
}
