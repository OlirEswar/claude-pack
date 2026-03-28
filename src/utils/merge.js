import chalk from 'chalk';
import inquirer from 'inquirer';

/**
 * Merges incoming MCP servers into existing ones.
 * Prompts the user on conflicts rather than silently overwriting.
 *
 * @returns {Promise<object>} merged mcpServers object
 */
export async function mergeMcpServers(existing, incoming) {
  const result = { ...existing };
  const conflicts = [];

  for (const [name, config] of Object.entries(incoming)) {
    if (result[name]) {
      conflicts.push({ name, config });
    } else {
      result[name] = config;
    }
  }

  for (const { name, config } of conflicts) {
    console.log(chalk.yellow(`\n  Conflict: MCP server "${name}" already exists`));
    console.log(chalk.dim(`  Existing: ${JSON.stringify(result[name])}`));
    console.log(chalk.dim(`  Incoming: ${JSON.stringify(config)}`));

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: `How should "${name}" be resolved?`,
        choices: [
          { name: 'Keep existing', value: 'keep' },
          { name: 'Replace with incoming', value: 'replace' },
        ],
      },
    ]);

    if (action === 'replace') {
      result[name] = config;
    }
  }

  return result;
}

/**
 * Appends incoming CLAUDE.md content to existing content with a clear delimiter
 * so the source is auditable and the section can be removed later.
 */
export function appendClaudeMd(existing, incoming, source) {
  const delimiter = [
    '',
    `<!-- claude-pack:begin source="${source}" -->`,
    '',
    incoming.trim(),
    '',
    `<!-- claude-pack:end source="${source}" -->`,
    '',
  ].join('\n');

  return (existing || '').trimEnd() + delimiter;
}
