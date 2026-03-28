#!/usr/bin/env node
import { program } from 'commander';
import { publishCommand } from '../src/commands/publish.js';
import { installCommand } from '../src/commands/install.js';
import { searchCommand } from '../src/commands/search.js';
import { updateCommand } from '../src/commands/update.js';
import { clearCommand } from '../src/commands/clear.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));

program
  .name('cc-config')
  .description('Share and install Claude Code setups')
  .version(pkg.version);

program
  .command('publish')
  .description('Publish your Claude Code setup to GitHub')
  .option('-n, --name <name>', 'Repository name')
  .option('-d, --description <desc>', 'Repository description')
  .option('--private', 'Make the repository private')
  .option('-g, --global', 'Publish global ~/.claude/ setup')
  .option('-p, --project', 'Publish project ./.claude/ setup')
  .action(publishCommand);

program
  .command('install <setup>')
  .description('Install a Claude Code setup (e.g., username/repo-name)')
  .option('-g, --global', 'Install to global ~/.claude/ config')
  .option('-p, --project', 'Install to project .claude/ config')
  .option('-l, --local', 'Install to project .claude/settings.local.json')
  .option('--dry-run', 'Preview changes without applying')
  .action(installCommand);

program
  .command('search [query]')
  .description('Search for Claude Code setups on GitHub')
  .option('-l, --limit <n>', 'Number of results', '10')
  .action(searchCommand);

program
  .command('update <repo>')
  .description('Update an existing setup repo with your current Claude config (e.g., username/repo-name)')
  .option('-m, --message <msg>', 'Commit message')
  .action(updateCommand);

program
  .command('clear')
  .description('Remove MCP servers, agents, skills, or CLAUDE.md sections from your setup')
  .option('-g, --global', 'Clear global ~/.claude/ setup')
  .option('-p, --project', 'Clear project ./.claude/ setup')
  .action(clearCommand);

program.parse();
