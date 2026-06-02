#!/usr/bin/env node

/**
 * Simple deployment script for MixHive - skips verification for faster deployment
 */

import chalk from 'chalk';
import { execSync } from 'child_process';

console.log(chalk.green('🚀 Starting MixHive production deployment (Simple Mode)...'));
console.log(chalk.blue('🎯 Deployment target: vercel'));

// Run build and test first
console.log(chalk.blue('🔨 Running build and test verification...'));
try {
  execSync('node scripts/build-and-test-deployment.js', { stdio: 'inherit' });
  console.log(chalk.green('✅ Build and test verification passed'));
} catch (error) {
  console.log(chalk.red('❌ Build and test verification failed'));
  console.log(chalk.yellow('💡 Fix the issues and try again'));
  process.exit(1);
}

// Deploy to Vercel
console.log(chalk.blue('\n🌐 Deploying to Vercel...'));

// Check if Vercel CLI is installed
try {
  execSync('vercel --version', { stdio: 'ignore' });
  console.log(chalk.green('✅ Vercel CLI found'));
} catch (error) {
  console.log(chalk.red('❌ Vercel CLI not found'));
  console.log(chalk.yellow('💡 Install with: npm install -g vercel'));
  process.exit(1);
}

// Deploy to Vercel
console.log(chalk.blue('🚀 Deploying to Vercel...'));

try {
  execSync('vercel --prod', { stdio: 'inherit' });
  console.log(chalk.green('✅ Deployment to Vercel completed'));

  console.log(chalk.green('\n🎉 MixHive deployment completed successfully!'));
  console.log(chalk.blue('📱 Your application should be available at:'));
  console.log(chalk.cyan('   https://mixhive.vercel.app'));
} catch (error) {
  console.log(chalk.red('❌ Deployment to Vercel failed'));
  console.log(chalk.red(error.message));
  process.exit(1);
}
