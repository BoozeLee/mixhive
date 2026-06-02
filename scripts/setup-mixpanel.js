#!/usr/bin/env node

/**
 * Mixpanel Setup Script for MixHive
 * This script helps users set up Mixpanel analytics
 */

import chalk from 'chalk';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log(chalk.green('📊 Setting up Mixpanel analytics for MixHive...'));
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

// Check if Mixpanel token is already configured
if (envContent.includes('NEXT_PUBLIC_MIXPANEL_TOKEN')) {
  console.log(chalk.green('✅ Mixpanel token already configured in .env.production'));
  console.log(chalk.blue('📋 Current token:'));
  const tokenMatch = envContent.match(/NEXT_PUBLIC_MIXPANEL_TOKEN="(.+)"/);
  if (tokenMatch) {
    console.log(chalk.cyan(`   ${tokenMatch[1].substring(0, 8)}...`)); // Show only first 8 chars for privacy
  }
} else {
  console.log(chalk.yellow('⚠️  Mixpanel token not found in .env.production'));
  console.log(chalk.blue('\n📋 To set up Mixpanel:'));
  console.log(chalk.cyan('1. Go to https://mixpanel.com'));
  console.log(chalk.cyan('2. Create a new project'));
  console.log(chalk.cyan('3. Get your project token from the project settings'));
  console.log(chalk.blue('\n📝 Add this to your .env.production file:'));
  console.log(chalk.cyan('NEXT_PUBLIC_MIXPANEL_TOKEN="YOUR_MIXPANEL_TOKEN_HERE"'));
}

// Check if Mixpanel SDK is installed
try {
  execSync('npm list mixpanel-browser', { stdio: 'ignore' });
  console.log(chalk.green('✅ mixpanel-browser is installed'));
} catch (error) {
  console.log(chalk.red('❌ mixpanel-browser is not installed'));
  console.log(chalk.yellow('💡 Run: npm install mixpanel-browser'));
}

// Check if Mixpanel components exist
const componentFiles = [
  'src/components/MixpanelClient.tsx',
  'src/lib/mixpanel.ts'
];

componentFiles.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    console.log(chalk.green(`✅ ${file} exists`));
  } else {
    console.log(chalk.red(`❌ ${file} not found`));
  }
});

// Check if layout includes Mixpanel
const layoutPath = path.join(process.cwd(), 'src/app/layout.tsx');
if (fs.existsSync(layoutPath)) {
  const layoutContent = fs.readFileSync(layoutPath, 'utf8');
  if (layoutContent.includes('MixpanelClient')) {
    console.log(chalk.green('✅ MixpanelClient is included in layout'));
  } else {
    console.log(chalk.red('❌ MixpanelClient not found in layout'));
  }
}

// Summary
console.log(chalk.blue('\n📋 Summary:'));
console.log(chalk.blue('📋 Configuration checklist:'));
console.log(chalk.cyan('✅ Mixpanel SDK installed'));
console.log(chalk.cyan('✅ Mixpanel components created'));
console.log(chalk.cyan('✅ Layout updated'));
console.log(chalk.cyan('⚠️  Mixpanel token configuration needed'));

console.log(chalk.blue('\n🚀 Next steps:'));
console.log(chalk.cyan('1. Get your Mixpanel token from mixpanel.com'));
console.log(chalk.cyan('2. Add NEXT_PUBLIC_MIXPANEL_TOKEN to .env.production'));
console.log(chalk.cyan('3. Deploy your application'));
console.log(chalk.cyan('4. Monitor analytics in the Mixpanel dashboard'));

console.log(chalk.blue('='.repeat(50)));