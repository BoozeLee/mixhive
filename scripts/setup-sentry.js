#!/usr/bin/env node

/**
 * Sentry Setup Script for MixHive
 * This script helps users set up Sentry error tracking
 */

import chalk from 'chalk';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log(chalk.green('🔍 Setting up Sentry error tracking for MixHive...'));
console.log(chalk.blue('='.repeat(50)));

// Check if environment file exists
const envPath = path.join(process.cwd(), '.env.production');
if (!fs.existsSync(envPath)) {
  console.log(chalk.red('❌ .env.production file not found'));
  console.log(chalk.yellow('💡 Please create the .env.production file first'));
  process.exit(1);
}

// Read environment file
const envContent = fs.readFileSync(envPath, 'utf8');

// Check if Sentry DSN is already configured
if (envContent.includes('NEXT_PUBLIC_SENTRY_DSN')) {
  console.log(chalk.green('✅ Sentry DSN already configured in .env.production'));
  console.log(chalk.blue('📋 Current DSN:'));
  const dsnMatch = envContent.match(/NEXT_PUBLIC_SENTRY_DSN="(.+)"/);
  if (dsnMatch) {
    console.log(chalk.cyan(`   ${dsnMatch[1]}`));
  }
} else {
  console.log(chalk.yellow('⚠️  Sentry DSN not found in .env.production'));
  console.log(chalk.blue('\n📋 To set up Sentry:'));
  console.log(chalk.cyan('1. Go to https://sentry.io'));
  console.log(chalk.cyan('2. Create a new project'));
  console.log(chalk.cyan('3. Select Next.js as the platform'));
  console.log(chalk.cyan('4. Copy the DSN from the project settings'));
  console.log(chalk.blue('\n📝 Add this to your .env.production file:'));
  console.log(chalk.cyan('NEXT_PUBLIC_SENTRY_DSN="YOUR_SENTRY_DSN_HERE"'));
}

// Check if Sentry environment variables are set
const requiredVars = ['NEXT_PUBLIC_SENTRY_DSN', 'SENTRY_DSN'];

console.log(chalk.blue('\n🔍 Checking Sentry configuration:'));
let allConfigured = true;

requiredVars.forEach(varName => {
  if (envContent.includes(varName)) {
    console.log(chalk.green(`✅ ${varName} is set`));
  } else {
    console.log(chalk.red(`❌ ${varName} is not set`));
    allConfigured = false;
  }
});

// Check if Sentry SDK is installed
try {
  execSync('npm list @sentry/nextjs', { stdio: 'ignore' });
  console.log(chalk.green('✅ @sentry/nextjs is installed'));
} catch (error) {
  console.log(chalk.red('❌ @sentry/nextjs is not installed'));
  console.log(chalk.yellow('💡 Run: npm install @sentry/nextjs'));
  allConfigured = false;
}

// Check if Sentry configuration files exist
const configFiles = ['sentry.client.config.js', 'sentry.server.config.js'];

configFiles.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    console.log(chalk.green(`✅ ${file} exists`));
  } else {
    console.log(chalk.red(`❌ ${file} not found`));
    allConfigured = false;
  }
});

// Summary
console.log(chalk.blue('\n📋 Summary:'));
if (allConfigured) {
  console.log(chalk.green('✅ Sentry is properly configured!'));
  console.log(chalk.blue('\n🚀 Next steps:'));
  console.log(chalk.cyan('1. Deploy your application with the Sentry DSN'));
  console.log(chalk.cyan('2. Monitor errors in the Sentry dashboard'));
  console.log(chalk.cyan('3. Set up alerts and notifications'));
} else {
  console.log(chalk.red('❌ Sentry configuration is incomplete'));
  console.log(chalk.yellow('💡 Please fix the issues above before deploying'));
}

console.log(chalk.blue('='.repeat(50)));
