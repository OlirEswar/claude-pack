import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import fs from 'fs-extra';
import { join } from 'path';
import {
  getClaudeDir,
  readGlobalMcpServers,
  readLocalMcpServers,
  readProjectMcpServers,
  writeGlobalMcpServers,
  writeLocalMcpServers,
  writeProjectMcpServers,
  readClaudeMd,
  readAgents,
  readSkills,
} from '../utils/config.js';

// Strip all <!-- claude-pack:begin ... --> ... <!-- claude-pack:end ... --> blocks
function stripClaudePackSections(content) {
  return content
    .replace(/\n<!-- claude-pack:begin source="[^"]*" -->\n[\s\S]*?<!-- claude-pack:end source="[^"]*" -->\n/g, '\n')
    .trimEnd();
}

export async function clearCommand(options) {
  console.log(chalk.bold('\n  claude-pack clear\n'));

  // Determine scope
  let scope;
  if (options.global) scope = 'global';
  else if (options.project) scope = 'project';
  else {
    const { selectedScope } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedScope',
        message: 'Which setup would you like to clear?',
        choices: [
          { name: `Personal  ~/.claude/      (global setup)`, value: 'global' },
          { name: `Project   ./.claude/      (this project's setup)`, value: 'project' },
        ],
      },
    ]);
    scope = selectedScope;
  }

  // Resolve paths
  const isGlobal = scope === 'global';
  const claudeDir = getClaudeDir();
  const cwd = process.cwd();
  const dotClaude = join(cwd, '.claude');

  const agentsDir = isGlobal ? join(claudeDir, 'agents') : join(dotClaude, 'agents');
  const skillsDir = isGlobal ? join(claudeDir, 'skills') : join(dotClaude, 'skills');
  const claudeMdPath = isGlobal ? join(claudeDir, 'CLAUDE.md') : join(cwd, 'CLAUDE.md');

  // Read current state
  const [mcpServers, agents, skills, claudeMd] = await Promise.all([
    isGlobal
      ? readGlobalMcpServers().then(async (g) => ({ ...g, ...(await readLocalMcpServers(cwd)) }))
      : readProjectMcpServers(cwd),
    readAgents(isGlobal ? claudeDir : dotClaude),
    readSkills(isGlobal ? claudeDir : dotClaude),
    readClaudeMd(claudeMdPath),
  ]);

  const mcpNames = Object.keys(mcpServers);
  const hasClaudePackMd = claudeMd && claudeMd.includes('claude-pack:begin');

  if (mcpNames.length === 0 && agents.length === 0 && skills.length === 0 && !hasClaudePackMd) {
    console.log(chalk.dim(`  Nothing to clear in ${scope} setup.\n`));
    return;
  }

  // Let user pick what to remove
  const choices = [];

  if (mcpNames.length > 0) {
    choices.push(new inquirer.Separator('── MCP Servers ──'));
    mcpNames.forEach((name) => choices.push({ name: `  ${name}`, value: `mcp:${name}` }));
  }

  if (agents.length > 0) {
    choices.push(new inquirer.Separator('── Agents ──'));
    agents.forEach((a) => choices.push({ name: `  ${a.name}`, value: `agent:${a.name}` }));
  }

  if (skills.length > 0) {
    choices.push(new inquirer.Separator('── Skills ──'));
    skills.forEach((s) => choices.push({ name: `  ${s.name}`, value: `skill:${s.name}` }));
  }

  if (hasClaudePackMd) {
    choices.push(new inquirer.Separator('── CLAUDE.md ──'));
    choices.push({ name: '  Remove claude-pack sections', value: 'claudemd' });
  }

  const { selected } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selected',
      message: 'Select items to remove:',
      choices,
      validate: (v) => v.length > 0 || 'Select at least one item',
    },
  ]);

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Remove ${selected.length} item(s) from ${scope} config?`,
      default: false,
    },
  ]);

  if (!confirm) {
    console.log(chalk.dim('\n  Cancelled.\n'));
    return;
  }

  const spinner = ora('Clearing...').start();

  try {
    const mcpToRemove = selected.filter((s) => s.startsWith('mcp:')).map((s) => s.slice(4));
    const agentsToRemove = selected.filter((s) => s.startsWith('agent:')).map((s) => s.slice(6));
    const skillsToRemove = selected.filter((s) => s.startsWith('skill:')).map((s) => s.slice(6));
    const clearMd = selected.includes('claudemd');

    // Remove MCP servers
    if (mcpToRemove.length > 0) {
      if (isGlobal) {
        const global = await readGlobalMcpServers();
        const local = await readLocalMcpServers(cwd);
        const newGlobal = Object.fromEntries(Object.entries(global).filter(([k]) => !mcpToRemove.includes(k)));
        const newLocal = Object.fromEntries(Object.entries(local).filter(([k]) => !mcpToRemove.includes(k)));
        await writeGlobalMcpServers(newGlobal);
        await writeLocalMcpServers(newLocal, cwd);
      } else {
        const project = await readProjectMcpServers(cwd);
        const newProject = Object.fromEntries(Object.entries(project).filter(([k]) => !mcpToRemove.includes(k)));
        await writeProjectMcpServers(newProject, cwd);
      }
    }

    // Remove agent files
    for (const name of agentsToRemove) {
      await fs.remove(join(agentsDir, name));
    }

    // Remove skill files
    for (const name of skillsToRemove) {
      await fs.remove(join(skillsDir, name));
    }

    // Strip CLAUDE.md sections
    if (clearMd && claudeMd) {
      const cleaned = stripClaudePackSections(claudeMd);
      if (cleaned.trim()) {
        await fs.writeFile(claudeMdPath, cleaned + '\n');
      } else {
        await fs.remove(claudeMdPath);
      }
    }

    spinner.succeed('Cleared!');
    console.log(chalk.green(`\n  Removed ${selected.length} item(s) from ${scope} config.\n`));
  } catch (err) {
    spinner.fail('Clear failed');
    console.error(chalk.red(`\n  ${err.message}\n`));
    process.exit(1);
  }
}
