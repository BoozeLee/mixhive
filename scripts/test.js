#!/usr/bin/env node

const { execSync } = require('child_process');
const chalk = require('chalk');

console.log(chalk.blue('🚀 Starting MixHive build and test pipeline...'));

// List of tasks to run
const tasks = [
  {
    name: 'TypeScript Compilation Check',
    command: 'npm run type-check',
    description: 'Checking TypeScript compilation...',
  },
  {
    name: 'ESLint Check',
    command: 'npm run lint',
    description: 'Running ESLint...',
  },
  {
    name: 'Prettier Format Check',
    command: 'npm run format:check',
    description: 'Checking code formatting...',
  },
  {
    name: 'Unit Tests',
    command: 'npm test',
    description: 'Running unit tests...',
  },
  {
    name: 'Build Application',
    command: 'npm run build',
    description: 'Building application...',
  },
  {
    name: 'Build Size Analysis',
    command: 'npm run analyze',
    description: 'Analyzing build size...',
  },
];

let passed = 0;
let failed = 0;

tasks.forEach((task, index) => {
  console.log(chalk.cyan(`\n${index + 1}. ${task.description}`));

  try {
    const startTime = Date.now();
    execSync(task.command, {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
    const duration = Date.now() - startTime;
    console.log(chalk.green(`✅ ${task.name} completed in ${duration}ms`));
    passed++;
  } catch (error) {
    console.log(chalk.red(`❌ ${task.name} failed`));
    console.log(chalk.red(`   Error: ${error.message}`));
    failed++;
  }
});

// Summary
console.log('\n' + '='.repeat(50));
console.log(chalk.bold('📊 Build & Test Summary'));
console.log('='.repeat(50));

if (failed === 0) {
  console.log(chalk.green(`🎉 All tasks passed! (${passed}/${passed})`));
  console.log(chalk.green('✅ MixHive is ready for deployment!'));
} else {
  console.log(chalk.red(`❌ ${failed} task(s) failed`));
  console.log(chalk.green(`✅ ${passed} task(s) passed`));
  console.log(chalk.red(`❌ Build failed with ${failed} error(s)`));
  process.exit(1);
}
