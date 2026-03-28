# cc-config

Share and install Claude Code setups — MCP servers, agents, skills, and CLAUDE.md — in one command.

```bash
npm install -g @olireswar/cc-config
```

> Requires [GitHub CLI](https://cli.github.com) (`gh`) and Node.js 18+.

## What it does

Claude Code setups include MCP servers, custom agents, skills, and CLAUDE.md instructions. `cc-config` lets you publish your setup to GitHub and install setups shared by others — no manual config editing.

Browse the community registry at **[cc-config.dev](https://github.com/OlirEswar/claude-pack)**

---

## Commands

### `cc-config search`

Search for setups shared by the community.

```bash
cc-config search
cc-config search playwright
```

### `cc-config install <owner/repo>`

Install a setup into your Claude Code config.

```bash
cc-config install OlirEswar/my-setup
```

Prompts you to choose a scope:
- **Global** — applies to all projects (`~/.claude.json`)
- **Project** — applies to the current project only (`.mcp.json`)
- **Local** — applies to the current project, not committed (`~/.claude.json` per-project)

MCP servers are merged with your existing config — no silent overwrites. Agents and skills are copied into the appropriate directory.

### `cc-config publish`

Publish your current Claude Code setup to a new GitHub repo, tagged for discovery.

```bash
cc-config publish
```

Prompts for scope (global `~/.claude/` or project `./.claude/`), repo name, and description. Secrets in MCP server configs (API keys, tokens, env vars) are automatically redacted before publishing.

### `cc-config update <owner/repo>`

Update an existing published setup repo with your current config.

```bash
cc-config update OlirEswar/my-setup
```

### `cc-config clear`

Interactively remove MCP servers, agents, skills, or CLAUDE.md sections from your config.

```bash
cc-config clear
```

---

## How it works

Setups are stored as public GitHub repos tagged with the topic `cc-config`. Each repo contains a `claude-setup.json` manifest:

```json
{
  "name": "my-setup",
  "version": "1.0.0",
  "description": "My Claude Code setup",
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp"]
    },
    "context7": {
      "type": "http",
      "url": "https://mcp.context7.com/mcp"
    }
  },
  "agents": ["researcher.md"],
  "skills": ["commit.md"]
}
```

Agents, skills, and CLAUDE.md are stored as files alongside the manifest.

---

## Authentication

`cc-config` uses the GitHub CLI for all GitHub operations. Run `gh auth login` once and you're set. No separate API keys needed.

---

## License

MIT
