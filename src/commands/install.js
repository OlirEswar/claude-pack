import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import fs from 'fs-extra';
import { join } from 'path';
import {
  getClaudeDir,
  readGlobalMcpServers,
  readProjectMcpServers,
  writeGlobalMcpServers,
  writeProjectMcpServers,
  readClaudeMd,
} from '../utils/config.js';
import { mergeMcpServers, appendClaudeMd } from '../utils/merge.js';
import { fetchSetupManifest, fetchRawFile, listDirectory } from '../utils/github.js';

export async function installCommand(setup, options) {
  const parts = setup.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    console.error(chalk.red('  Invalid format. Use: cc-config install username/repo-name'));
    process.exit(1);
  }
  const [owner, repo] = parts;

  console.log(chalk.bold(`\n  cc-config install ${owner}/${repo}\n`));

  // Fetch manifest
  const fetchSpinner = ora('Fetching setup manifest...').start();
  const manifest = await fetchSetupManifest(owner, repo);

  if (!manifest) {
    fetchSpinner.fail(`No claude-setup.json found in ${owner}/${repo}`);
    process.exit(1);
  }
  fetchSpinner.succeed(`Found: ${manifest.description || manifest.name}`);

  // Summarise what's included
  const mcpServers = manifest.mcpServers || {};
  const mcpCount = Object.keys(mcpServers).length;

  const [agentFiles, skillFiles, claudeMdContent] = await Promise.all([
    listDirectory(owner, repo, 'agents'),
    listDirectory(owner, repo, 'skills'),
    fetchRawFile(owner, repo, 'CLAUDE.md'),
  ]);

  const agentMdFiles = agentFiles.filter((f) => f.name.endsWith('.md'));
  const skillMdFiles = skillFiles.filter((f) => f.name.endsWith('.md'));

  if (mcpCount > 0) {
    for (const [name, config] of Object.entries(mcpServers)) {
      const isHttp = config.type === 'http' || config.type === 'sse';
      const tag = isHttp ? chalk.yellow('⚠ requires authentication') : chalk.green('✓ ready');
      console.log(`    • ${name}  ${tag}`);
    }
  } else {
    console.log(chalk.dim(`    • 0 MCP server(s)`));
  }
  console.log(chalk.dim(`    • ${agentMdFiles.length} agent(s)`));
  console.log(chalk.dim(`    • ${skillMdFiles.length} skill(s)`));
  console.log(chalk.dim(`    • CLAUDE.md: ${claudeMdContent ? 'yes' : 'no'}`));

  // Determine install scope
  let scope;
  if (options.global) scope = 'global';
  else if (options.project) scope = 'project';
  else if (options.local) scope = 'local';
  else {
    const { selectedScope } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedScope',
        message: 'Where would you like to install?',
        choices: [
          { name: `Global   ~/.claude.json              (all projects)`, value: 'global' },
          { name: `Project  ./.mcp.json                 (this project, committed)`, value: 'project' },
          { name: `Local    ~/.claude/                  (this project, not committed)`, value: 'local' },
        ],
      },
    ]);
    scope = selectedScope;
  }

  // Resolve paths for agents, skills, and CLAUDE.md based on scope
  let claudeMdPath, agentsDir, skillsDir;

  if (scope === 'global') {
    const claudeDir = getClaudeDir();
    claudeMdPath = join(claudeDir, 'CLAUDE.md');
    agentsDir = join(claudeDir, 'agents');
    skillsDir = join(claudeDir, 'skills');
  } else {
    const dotClaude = join(process.cwd(), '.claude');
    claudeMdPath = join(process.cwd(), 'CLAUDE.md');
    agentsDir = join(dotClaude, 'agents');
    skillsDir = join(dotClaude, 'skills');
  }

  // Dry run: just show what would happen
  if (options.dryRun) {
    console.log(chalk.bold('\n  Dry run — no changes will be made:\n'));
    if (mcpCount > 0) {
      const mcpTarget = scope === 'project' ? './.mcp.json' : '~/.claude.json';
      console.log(chalk.dim(`    MCP servers → ${mcpTarget} (merge)`));
    }
    if (claudeMdContent) console.log(chalk.dim(`    CLAUDE.md   → ${claudeMdPath} (append)`));
    if (agentMdFiles.length > 0) console.log(chalk.dim(`    Agents      → ${agentsDir}/`));
    if (skillMdFiles.length > 0) console.log(chalk.dim(`    Skills      → ${skillsDir}/`));
    console.log();
    return;
  }

  // Read existing MCP servers from the correct file for the chosen scope
  const existingMcp =
    scope === 'project'
      ? await readProjectMcpServers(process.cwd())
      : await readGlobalMcpServers();

  // Merge MCP servers (prompts on conflict)
  const mergedMcp = mcpCount > 0
    ? await mergeMcpServers(existingMcp, mcpServers)
    : existingMcp;

  // Confirm before writing
  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Apply changes to ${scope} config?`,
      default: true,
    },
  ]);

  if (!confirm) {
    console.log(chalk.dim('\n  Cancelled.\n'));
    return;
  }

  const applySpinner = ora('Applying setup...').start();

  try {
    // Write merged MCP servers to the correct file
    if (mcpCount > 0) {
      if (scope === 'project') {
        await writeProjectMcpServers(mergedMcp, process.cwd());
      } else {
        await writeGlobalMcpServers(mergedMcp);
      }
    }

    // Append CLAUDE.md with delimiter
    if (claudeMdContent) {
      const existingMd = await readClaudeMd(claudeMdPath);
      const newMd = appendClaudeMd(existingMd, claudeMdContent, `${owner}/${repo}`);
      await fs.ensureFile(claudeMdPath);
      await fs.writeFile(claudeMdPath, newMd);
    }

    // Copy agent files
    if (agentMdFiles.length > 0) {
      await fs.ensureDir(agentsDir);
      for (const file of agentMdFiles) {
        const content = await fetchRawFile(owner, repo, `agents/${file.name}`);
        if (content) {
          await fs.writeFile(join(agentsDir, file.name), content);
        }
      }
    }

    // Copy skill files
    if (skillMdFiles.length > 0) {
      await fs.ensureDir(skillsDir);
      for (const file of skillMdFiles) {
        const content = await fetchRawFile(owner, repo, `skills/${file.name}`);
        if (content) {
          await fs.writeFile(join(skillsDir, file.name), content);
        }
      }
    }

    applySpinner.succeed('Setup installed!');
    console.log(chalk.green(`\n  Installed ${owner}/${repo} → ${scope}`));
    console.log();
  } catch (err) {
    applySpinner.fail('Install failed');
    console.error(chalk.red(`\n  ${err.message}\n`));
    process.exit(1);
  }
}
