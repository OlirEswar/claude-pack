import chalk from 'chalk';
import ora from 'ora';
import { searchSetups } from '../utils/github.js';

export async function searchCommand(query, options) {
  const limit = parseInt(options.limit, 10) || 10;
  const label = query ? `"${query}"` : 'all setups';

  console.log(chalk.bold(`\n  claude-pack search ${label}\n`));

  const spinner = ora('Searching GitHub...').start();

  try {
    const results = await searchSetups(query, limit);
    spinner.stop();

    if (results.length === 0) {
      console.log(chalk.dim('  No setups found.\n'));
      return;
    }

    for (const repo of results) {
      const stars = repo.stargazers_count;
      const starLabel = stars === 1 ? '1 star' : `${stars} stars`;

      console.log(`  ${chalk.green(repo.full_name)}  ${chalk.dim(starLabel)}`);

      if (repo.description) {
        console.log(`  ${chalk.dim(repo.description)}`);
      }

      const topics = (repo.topics || []).filter((t) => t !== 'claude-pack');
      if (topics.length > 0) {
        console.log(`  ${chalk.dim(topics.map((t) => `#${t}`).join('  '))}`);
      }

      console.log(`  ${chalk.cyan(`claude-pack install ${repo.full_name}`)}`);
      console.log();
    }
  } catch (err) {
    spinner.fail('Search failed');
    console.error(chalk.red(`\n  ${err.message}\n`));
    process.exit(1);
  }
}
