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
import { getGhToken } from '../utils/github.js';

export async function updateCommand(repo, options) {
  console.log(chalk.bold(`\n  claude-pack update ${repo}\n`));

  const token = getGhToken();
  if (!token) {
    console.error(chalk.red('  GitHub CLI not authenticated. Run: gh auth login'));
    process.exit(1);
  }

  // Verify the repo exists and we have access
  const checkSpinner = ora('Checking repository...').start();
  try {
    execSync(`gh repo view ${repo}`, { stdio: 'pipe' });
    checkSpinner.succeed(`Found ${repo}`);
  } catch {
    checkSpinner.fail(`Repository "${repo}" not found or not accessible`);
    process.exit(1);
  }

  // Read current setup
  const { scope } = await inquirer.prompt([
    {
      type: 'list',
      name: 'scope',
      message: 'Update from:',
      choices: [
        { name: `Personal  ~/.claude/      (your global setup)`, value: 'global' },
        { name: `Project   ./.claude/      (this project's setup)`, value: 'project' },
      ],
    },
  ]);

  const readSpinner = ora('Reading your Claude setup...').start();
  const claudeDir = getClaudeDir();
  const cwd = process.cwd();

  let mcpServers;
  let claudeMd;
  let agents;
  let skills;

  if (scope === 'global') {
    mcpServers = await readGlobalMcpServers();
    claudeMd = await readClaudeMd(join(claudeDir, 'CLAUDE.md'));
    agents = await readAgents(claudeDir);
    skills = await readSkills(claudeDir);
  } else {
    const dotClaude = join(cwd, '.claude');
    const [localMcp, sharedMcp] = await Promise.all([
      readLocalMcpServers(cwd),
      readProjectMcpServers(cwd),
    ]);
    mcpServers = { ...localMcp, ...sharedMcp };
    claudeMd = (await readClaudeMd(join(cwd, 'CLAUDE.md'))) || (await readClaudeMd(join(dotClaude, 'CLAUDE.md')));
    agents = await readAgents(dotClaude);
    skills = await readSkills(dotClaude);
  }

  readSpinner.succeed('Read Claude setup');

  console.log(chalk.dim(`    • ${Object.keys(mcpServers).length} MCP server(s)`));
  console.log(chalk.dim(`    • ${agents.length} agent(s)`));
  console.log(chalk.dim(`    • ${skills.length} skill(s)`));
  console.log(chalk.dim(`    • CLAUDE.md: ${claudeMd ? 'yes' : 'no'}`));

  // Strip secrets
  const { result: cleanMcp, warnings } = stripSecrets({ mcpServers });
  if (warnings.length > 0) {
    console.log(chalk.yellow(`\n  Redacted ${warnings.length} potential secret(s):`));
    warnings.forEach((w) => console.log(chalk.yellow(`    - ${w}`)));
    console.log(chalk.dim('  These will be published as <REDACTED>.'));
  }

  const answers = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'includeCLAUDEmd',
      message: 'Include CLAUDE.md?',
      default: true,
      when: () => !!claudeMd,
    },
    {
      type: 'input',
      name: 'message',
      message: 'Commit message:',
      default: options.message || 'Update claude-pack setup',
    },
    {
      type: 'confirm',
      name: 'confirm',
      message: `Push update to ${repo}?`,
      default: true,
    },
  ]);

  if (!answers.confirm) {
    console.log(chalk.dim('\n  Cancelled.\n'));
    return;
  }

  // Build updated files into a temp dir
  const tmpDir = join(tmpdir(), `claude-pack-update-${Date.now()}`);
  await fs.ensureDir(tmpDir);

  try {
    const manifest = {
      name: repo.split('/')[1],
      version: '1.0.0',
      mcpServers: cleanMcp.mcpServers || {},
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

    const updateSpinner = ora('Cloning and updating repository...').start();

    const cloneDir = join(tmpdir(), `claude-pack-clone-${Date.now()}`);
    try {
      execSync(`gh repo clone ${repo} ${cloneDir}`, { stdio: 'pipe' });

      // Remove old agents/skills to handle deletions, then copy fresh files
      await fs.remove(join(cloneDir, 'agents'));
      await fs.remove(join(cloneDir, 'skills'));
      await fs.copy(tmpDir, cloneDir, { overwrite: true });

      execSync('git add -A', { cwd: cloneDir, stdio: 'pipe' });

      const diff = execSync('git status --porcelain', { cwd: cloneDir, encoding: 'utf8' });
      if (!diff.trim()) {
        updateSpinner.info('No changes to push.');
        return;
      }

      const gitEnv = {
        ...process.env,
        GIT_AUTHOR_NAME: 'claude-pack',
        GIT_COMMITTER_NAME: 'claude-pack',
        GIT_AUTHOR_EMAIL: 'noreply@claude-pack',
        GIT_COMMITTER_EMAIL: 'noreply@claude-pack',
      };

      execSync(`git commit -m "${answers.message}"`, { cwd: cloneDir, stdio: 'pipe', env: gitEnv });
      execSync(`git remote set-url origin https://${token}@github.com/${repo}.git`, { cwd: cloneDir, stdio: 'pipe' });
      execSync('git push', { cwd: cloneDir, stdio: 'pipe' });

      updateSpinner.succeed('Updated!');
      console.log(chalk.green(`\n  https://github.com/${repo}`));
      console.log(chalk.dim(`  Install with: claude-pack install ${repo}\n`));
    } finally {
      await fs.remove(cloneDir);
    }
  } catch (err) {
    console.error(chalk.red(`\n  ${err.message}\n`));
    process.exit(1);
  } finally {
    await fs.remove(tmpDir);
  }
}
