#!/usr/bin/env node

const { execSync } = require('child_process');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

console.log(chalk.blue('🚀 Starting MixHive deployment process...'));

// Check if we're in the correct directory
if (!fs.existsSync('package.json')) {
  console.log(
    chalk.red('❌ Error: package.json not found. Please run this script from the project root.')
  );
  process.exit(1);
}

// Check environment variables
const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SENTRY_DSN',
  'NEXT_PUBLIC_VERCEL_ANALYTICS_ID',
  'NEXT_PUBLIC_VERCEL_SPEED_INSIGHTS_ID',
  'NEXTAUTH_SECRET',
  'REDIS_URL',
];

console.log(chalk.yellow('🔍 Checking environment variables...'));

const missingEnvVars = requiredEnvVars.filter(varName => {
  const value = process.env[varName];
  if (!value) {
    console.log(chalk.red(`❌ Missing: ${varName}`));
    return true;
  }
  return false;
});

if (missingEnvVars.length > 0) {
  console.log(chalk.red(`❌ ${missingEnvVars.length} required environment variables are missing!`));
  console.log(chalk.yellow('💡 Please check your .env file or environment variables.'));
  process.exit(1);
}

console.log(chalk.green('✅ All required environment variables are set.'));

// Deployment steps
const steps = [
  {
    name: 'Install Dependencies',
    command: 'npm ci',
    description: 'Installing production dependencies...',
  },
  {
    name: 'Generate Database Types',
    command: 'npm run db:types',
    description: 'Generating database types...',
  },
  {
    name: 'TypeScript Check',
    command: 'npm run type-check',
    description: 'Checking TypeScript compilation...',
  },
  {
    name: 'Lint Check',
    command: 'npm run lint',
    description: 'Running ESLint...',
  },
  {
    name: 'Format Check',
    command: 'npm run format:check',
    description: 'Checking code formatting...',
  },
  {
    name: 'Run Tests',
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

steps.forEach((step, index) => {
  console.log(chalk.cyan(`\n${index + 1}. ${step.description}`));

  try {
    const startTime = Date.now();
    execSync(step.command, {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: { ...process.env, NODE_ENV: 'production' },
    });
    const duration = Date.now() - startTime;
    console.log(chalk.green(`✅ ${step.name} completed in ${duration}ms`));
    passed++;
  } catch (error) {
    console.log(chalk.red(`❌ ${step.name} failed`));
    console.log(chalk.red(`   Error: ${error.message}`));
    failed++;
  }
});

// Add deployment verification step
if (failed === 0) {
  console.log('\n' + chalk.cyan('🔍 Running deployment verification...'));

  try {
    execSync('node scripts/deploy-verify.js', {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: { ...process.env, NODE_ENV: 'production' },
    });
    console.log(chalk.green('✅ Deployment verification passed'));
    passed++;
  } catch (error) {
    console.log(chalk.red('❌ Deployment verification failed'));
    console.log(chalk.red(`   Error: ${error.message}`));
    failed++;
  }
}

// Check if we can deploy to Vercel
if (failed === 0) {
  console.log('\n' + '='.repeat(50));
  console.log(chalk.bold('🎯 Deployment Ready!'));
  console.log('='.repeat(50));

  console.log(chalk.green('✅ All checks passed! MixHive is ready for deployment.'));

  // Check if we have Vercel CLI installed
  try {
    execSync('vercel --version', { stdio: 'ignore' });
    console.log(chalk.blue('📦 Vercel CLI found.'));

    console.log('\n' + chalk.yellow('🚀 To deploy to Vercel:'));
    console.log(chalk.yellow('   vercel --prod'));
    console.log(chalk.yellow('   or run: npm run deploy:vercel'));

    // Check if we have the Vercel secrets
    if (process.env.VERCEL_TOKEN && process.env.VERCEL_ORG_ID && process.env.VERCEL_PROJECT_ID) {
      console.log('\n' + chalk.green('🎉 Environment variables for Vercel are set.'));
      console.log(chalk.green('   Ready for automated deployment!'));
    } else {
      console.log('\n' + chalk.yellow('⚠️  Vercel environment variables not set.'));
      console.log(
        chalk.yellow(
          '   Set VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID to enable automated deployment.'
        )
      );
    }
  } catch (error) {
    console.log(chalk.yellow('⚠️  Vercel CLI not found.'));
    console.log(chalk.yellow('   Install it with: npm install -g vercel'));
  }

  // Docker deployment info
  console.log('\n' + chalk.blue('🐳 Docker deployment options:'));
  console.log(chalk.blue('   docker build -t mixhive .'));
  console.log(chalk.blue('   docker run -p 3000:3000 mixhive'));

  console.log('\n' + chalk.green('🎉 MixHive deployment preparation complete!'));
} else {
  console.log('\n' + '='.repeat(50));
  console.log(chalk.bold('❌ Deployment Failed'));
  console.log('='.repeat(50));
  console.log(chalk.red(`❌ ${failed} task(s) failed`));
  console.log(chalk.green(`✅ ${passed} task(s) passed`));
  console.log(chalk.red(`❌ Cannot deploy with ${failed} error(s)`));
  process.exit(1);
}
