import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import fs from 'fs-extra';
import { join } from 'path';
import { tmpdir } from 'os';
import { execSync } from 'child_process';
import {
  getClaudeDir,
  readGlobalMcpServers,
  readLocalMcpServers,
  readProjectMcpServers,
  readClaudeMd,
  readAgents,
  readSkills,
} from '../utils/config.js';
import { stripSecrets } from '../utils/secrets.js';
import { getGhToken, getGhUsername } from '../utils/github.js';

function repoExists(fullName) {
  try {
    execSync(`gh repo view ${fullName}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

async function readSetup(scope) {
  if (scope === 'global') {
    const claudeDir = getClaudeDir();
    return {
      mcpServers: await readGlobalMcpServers(),
      claudeMd: await readClaudeMd(join(claudeDir, 'CLAUDE.md')),
      agents: await readAgents(claudeDir),
      skills: await readSkills(claudeDir),
    };
  } else {
    const cwd = process.cwd();
    const dotClaude = join(cwd, '.claude');
    const rootMd = await readClaudeMd(join(cwd, 'CLAUDE.md'));
    const dotMd = await readClaudeMd(join(dotClaude, 'CLAUDE.md'));
    // Merge local (~/.claude.json projects[path]) and shared (.mcp.json) MCP servers
    const [localMcp, sharedMcp] = await Promise.all([
      readLocalMcpServers(cwd),
      readProjectMcpServers(cwd),
    ]);
    return {
      mcpServers: { ...localMcp, ...sharedMcp },
      claudeMd: rootMd || dotMd,
      agents: await readAgents(dotClaude),
      skills: await readSkills(dotClaude),
    };
  }
}

export async function publishCommand(options) {
  console.log(chalk.bold('\n  claude-pack publish\n'));

  const token = getGhToken();
  if (!token) {
    console.error(chalk.red('  GitHub CLI not authenticated. Run: gh auth login'));
    process.exit(1);
  }

  // Determine scope
  let scope;
  if (options.global) scope = 'global';
  else if (options.project) scope = 'project';
  else {
    const { selectedScope } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedScope',
        message: 'Publish from:',
        choices: [
          { name: `Personal  ~/.claude/      (your global setup)`, value: 'global' },
          { name: `Project   ./.claude/      (this project's setup)`, value: 'project' },
        ],
      },
    ]);
    scope = selectedScope;
  }

  // Read setup from the chosen scope
  const spinner = ora(`Reading ${scope} Claude setup...`).start();
  const { mcpServers, claudeMd, agents, skills } = await readSetup(scope);
  spinner.succeed(`Read ${scope} Claude setup`);

  console.log(chalk.dim(`    • ${Object.keys(mcpServers).length} MCP server(s)`));
  console.log(chalk.dim(`    • ${agents.length} agent(s)`));
  console.log(chalk.dim(`    • ${skills.length} skill(s)`));
  console.log(chalk.dim(`    • CLAUDE.md: ${claudeMd ? 'yes' : 'no'}`));

  // Strip secrets from MCP server configs (env vars, tokens, etc.)
  const { result: cleanMcpServers, warnings } = stripSecrets({ mcpServers });
  if (warnings.length > 0) {
    console.log(chalk.yellow(`\n  Redacted ${warnings.length} potential secret(s):`));
    warnings.forEach((w) => console.log(chalk.yellow(`    - ${w}`)));
    console.log(chalk.dim('  These will be published as <REDACTED>.'));
  }

  // Get username early so we can check if repo exists
  const username = getGhUsername();

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Repository name:',
      default: options.name || 'my-claude-setup',
      validate: (v) =>
        /^[a-z0-9][a-z0-9-]*$/.test(v) || 'Use lowercase letters, numbers, and hyphens only',
    },
    {
      type: 'input',
      name: 'description',
      message: 'Description:',
      default: options.description || 'My Claude Code setup',
    },
    {
      type: 'confirm',
      name: 'private',
      message: 'Make repository private?',
      default: options.private || false,
    },
    {
      type: 'confirm',
      name: 'includeCLAUDEmd',
      message: 'Include CLAUDE.md?',
      default: true,
      when: () => !!claudeMd,
    },
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Ready to publish?',
      default: true,
    },
  ]);

  if (!answers.confirm) {
    console.log(chalk.dim('\n  Cancelled.\n'));
    return;
  }

  const fullName = `${username}/${answers.name}`;
  const exists = repoExists(fullName);

  if (exists) {
    console.log(chalk.dim(`\n  Found existing repo: ${fullName}`));
  }

  const tmpDir = join(tmpdir(), `claude-pack-${Date.now()}`);
  await fs.ensureDir(tmpDir);

  try {
    // Build files into tmpDir
    const manifest = {
      name: answers.name,
      version: '1.0.0',
      description: answers.description,
      mcpServers: cleanMcpServers.mcpServers || {},
    };
    if (agents.length > 0) manifest.agents = agents.map((a) => a.name);
    if (skills.length > 0) manifest.skills = skills.map((s) => s.name);

    await fs.writeJson(join(tmpDir, 'claude-setup.json'), manifest, { spaces: 2 });

    if (claudeMd && answers.includeCLAUDEmd) {
      await fs.writeFile(join(tmpDir, 'CLAUDE.md'), claudeMd);
    }

    if (agents.length > 0) {
      const agentsDir = join(tmpDir, 'agents');
      await fs.ensureDir(agentsDir);
      for (const agent of agents) {
        await fs.writeFile(join(agentsDir, agent.name), agent.content);
      }
    }

    if (skills.length > 0) {
      const skillsDir = join(tmpDir, 'skills');
      await fs.ensureDir(skillsDir);
      for (const skill of skills) {
        await fs.writeFile(join(skillsDir, skill.name), skill.content);
      }
    }

    const publishSpinner = ora(exists ? 'Updating repository...' : 'Creating repository...').start();

    try {
      const gitEnv = {
        ...process.env,
        GIT_AUTHOR_NAME: 'claude-pack',
        GIT_COMMITTER_NAME: 'claude-pack',
        GIT_AUTHOR_EMAIL: 'noreply@claude-pack',
        GIT_COMMITTER_EMAIL: 'noreply@claude-pack',
      };

      if (exists) {
        // Clone the existing repo, overwrite files, push a new commit
        const cloneDir = join(tmpdir(), `claude-pack-clone-${Date.now()}`);
        try {
          execSync(`gh repo clone ${fullName} ${cloneDir}`, { stdio: 'pipe' });

          // Overwrite with fresh files (remove old agents/skills first to handle deletions)
          await fs.remove(join(cloneDir, 'agents'));
          await fs.remove(join(cloneDir, 'skills'));
          await fs.copy(tmpDir, cloneDir, { overwrite: true });

          execSync('git add -A', { cwd: cloneDir, stdio: 'pipe' });

          // Only commit if there are actual changes
          const diff = execSync('git status --porcelain', { cwd: cloneDir, encoding: 'utf8' });
          if (!diff.trim()) {
            publishSpinner.info('No changes to publish.');
            return;
          }

          execSync('git commit -m "Update claude-pack setup"', { cwd: cloneDir, stdio: 'pipe', env: gitEnv });
          execSync('git push', { cwd: cloneDir, stdio: 'pipe' });
        } finally {
          await fs.remove(cloneDir);
        }
      } else {
        // Create a fresh repo
        execSync('git init -b main', { cwd: tmpDir, stdio: 'pipe' });
        execSync('git add .', { cwd: tmpDir, stdio: 'pipe' });
        execSync('git commit -m "Initial claude-pack setup"', { cwd: tmpDir, stdio: 'pipe', env: gitEnv });

        const visibility = answers.private ? '--private' : '--public';
        execSync(
          `gh repo create ${fullName} ${visibility} --description "${answers.description}" --source=. --push`,
          { cwd: tmpDir, stdio: 'pipe' },
        );

        execSync(`gh repo edit ${fullName} --add-topic claude-pack`, { stdio: 'pipe' });
      }

      publishSpinner.succeed(exists ? 'Updated!' : 'Published!');
      console.log(chalk.green(`\n  https://github.com/${fullName}`));
      console.log(chalk.dim(`  Install with: claude-pack install ${fullName}\n`));
    } catch (err) {
      publishSpinner.fail(exists ? 'Update failed' : 'Publish failed');
      console.error(chalk.red(`\n  ${err.message}\n`));
      process.exit(1);
    }
  } finally {
    await fs.remove(tmpDir);
  }
}
