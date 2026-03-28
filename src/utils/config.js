import { homedir } from 'os';
import { join } from 'path';
import fs from 'fs-extra';

export function getClaudeDir() {
  return join(homedir(), '.claude');
}

// ~/.claude/settings.json — permissions, hooks, plugins (not MCP servers)
export async function readGlobalSettings() {
  const path = join(getClaudeDir(), 'settings.json');
  if (await fs.pathExists(path)) {
    return fs.readJson(path);
  }
  return {};
}

// ~/.claude.json — stores both global MCP servers (top-level mcpServers)
// and per-project local MCP servers (projects["/path"].mcpServers)

function getClaudeJsonPath() {
  return join(homedir(), '.claude.json');
}

async function readClaudeJson() {
  const path = getClaudeJsonPath();
  if (await fs.pathExists(path)) return fs.readJson(path);
  return {};
}

async function writeClaudeJson(data) {
  await fs.writeJson(getClaudeJsonPath(), data, { spaces: 2 });
}

// Global MCP servers: top-level mcpServers in ~/.claude.json
export async function readGlobalMcpServers() {
  const data = await readClaudeJson();
  return data.mcpServers || {};
}

export async function writeGlobalMcpServers(mcpServers) {
  const data = await readClaudeJson();
  data.mcpServers = mcpServers;
  await writeClaudeJson(data);
}

// Local MCP servers: per-project, stored in ~/.claude.json under projects[path].mcpServers
// This is what `claude mcp add` without --global writes to
export async function readLocalMcpServers(dir = process.cwd()) {
  const data = await readClaudeJson();
  return data.projects?.[dir]?.mcpServers || {};
}

export async function writeLocalMcpServers(mcpServers, dir = process.cwd()) {
  const data = await readClaudeJson();
  if (!data.projects) data.projects = {};
  if (!data.projects[dir]) data.projects[dir] = {};
  data.projects[dir].mcpServers = mcpServers;
  await writeClaudeJson(data);
}

// .mcp.json in project root — shared/committed project-scoped MCP servers
export async function readProjectMcpServers(dir = process.cwd()) {
  const path = join(dir, '.mcp.json');
  if (await fs.pathExists(path)) {
    const data = await fs.readJson(path);
    return data.mcpServers || {};
  }
  return {};
}

export async function writeProjectMcpServers(mcpServers, dir = process.cwd()) {
  const path = join(dir, '.mcp.json');
  const data = (await fs.pathExists(path)) ? await fs.readJson(path) : {};
  data.mcpServers = mcpServers;
  await fs.writeJson(path, data, { spaces: 2 });
}

export async function readProjectSettings(dir = process.cwd(), local = false) {
  const filename = local ? 'settings.local.json' : 'settings.json';
  const path = join(dir, '.claude', filename);
  if (await fs.pathExists(path)) {
    return fs.readJson(path);
  }
  return {};
}

export async function readClaudeMd(filePath) {
  if (await fs.pathExists(filePath)) {
    return fs.readFile(filePath, 'utf8');
  }
  return null;
}

export async function readAgents(dir) {
  const agentsDir = join(dir, 'agents');
  if (!(await fs.pathExists(agentsDir))) return [];

  const files = await fs.readdir(agentsDir);
  const agents = [];
  for (const file of files) {
    if (file.endsWith('.md')) {
      const content = await fs.readFile(join(agentsDir, file), 'utf8');
      agents.push({ name: file, content });
    }
  }
  return agents;
}

export async function readSkills(dir) {
  const skillsDir = join(dir, 'skills');
  if (!(await fs.pathExists(skillsDir))) return [];

  const files = await fs.readdir(skillsDir);
  const skills = [];
  for (const file of files) {
    if (file.endsWith('.md')) {
      const content = await fs.readFile(join(skillsDir, file), 'utf8');
      skills.push({ name: file, content });
    }
  }
  return skills;
}
