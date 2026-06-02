#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import chalk from 'chalk';

console.log(chalk.blue('🔍 Checking environment variables...'));

// Required environment variables
const requiredVars = [
  'NODE_ENV',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_CDN_BASE_URL',
  'NEXTAUTH_URL',
  'NEXTAUTH_SECRET',
];

// Optional environment variables
const optionalVars = [
  'NEXT_PUBLIC_SENTRY_DSN',
  'NEXT_PUBLIC_VERCEL_ANALYTICS_ID',
  'NEXT_PUBLIC_VERCEL_SPEED_INSIGHTS_ID',
  'REDIS_URL',
  'REDIS_CLUSTER_URL',
  'OPENAI_API_KEY',
  'HUGGINGFACE_API_KEY',
  'SPOTIFY_CLIENT_ID',
  'SPOTIFY_CLIENT_SECRET',
  'SOUNDCLOUD_CLIENT_ID',
  'SOUNDCLOUD_CLIENT_SECRET',
  'NEXT_PUBLIC_GA_ID',
  'NEXT_PUBLIC_MIXPANEL_TOKEN',
];

// Check if we're in production
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env';
const envPath = path.join(process.cwd(), envFile);

console.log(chalk.yellow(`\n📁 Checking environment file: ${envFile}`));

// Check if environment file exists
if (!fs.existsSync(envPath)) {
  console.log(chalk.red(`❌ Environment file not found: ${envPath}`));
  console.log(chalk.yellow('💡 Create this file from .env.example'));
  process.exit(1);
}

// Load environment variables
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = envContent
  .split('\n')
  .filter(line => line.trim() && !line.startsWith('#'))
  .reduce((acc, line) => {
    const [key, value] = line.split('=');
    if (key && value) {
      acc[key] = value.trim();
    }
    return acc;
  }, {});

// Check required variables
console.log(chalk.blue('\n🔐 Required Variables:'));
let missingRequired = 0;

requiredVars.forEach(varName => {
  const value = envVars[varName];
  if (!value || value === 'your-' + varName.toLowerCase() || value.includes('your-')) {
    console.log(chalk.red(`❌ ${varName}: Missing or using placeholder`));
    missingRequired++;
  } else {
    console.log(chalk.green(`✅ ${varName}: Set`));
  }
});

// Check optional variables
console.log(chalk.blue('\n📊 Optional Variables:'));
let missingOptional = 0;

optionalVars.forEach(varName => {
  const value = envVars[varName];
  if (!value || value === 'your-' + varName.toLowerCase() || value.includes('your-')) {
    console.log(chalk.yellow(`⚠️  ${varName}: Not set (optional)`));
    missingOptional++;
  } else {
    console.log(chalk.green(`✅ ${varName}: Set`));
  }
});

// Environment validation
console.log(chalk.blue('\n🔍 Environment Validation:'));

// Validate Supabase URL format
if (envVars.NEXT_PUBLIC_SUPABASE_URL) {
  const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl.includes('supabase.co')) {
    console.log(chalk.green('✅ Supabase URL format is correct'));
  } else {
    console.log(chalk.red('❌ Supabase URL should end with .supabase.co'));
  }
}

// Validate CDN URL format
if (envVars.NEXT_PUBLIC_CDN_BASE_URL) {
  const cdnUrl = envVars.NEXT_PUBLIC_CDN_BASE_URL;
  if (cdnUrl.startsWith('https://')) {
    console.log(chalk.green('✅ CDN URL uses HTTPS'));
  } else {
    console.log(chalk.red('❌ CDN URL should use HTTPS'));
  }
}

// Validate NextAuth secret length
if (envVars.NEXTAUTH_SECRET) {
  const secret = envVars.NEXTAUTH_SECRET;
  if (secret.length >= 32) {
    console.log(chalk.green('✅ NextAuth secret length is sufficient'));
  } else {
    console.log(chalk.red('❌ NextAuth secret should be at least 32 characters'));
  }
}

// Summary
console.log(chalk.blue('\n📋 Summary:'));
console.log(chalk.blue('================'));

if (missingRequired === 0) {
  console.log(chalk.green('✅ All required environment variables are set'));
} else {
  console.log(chalk.red(`❌ ${missingRequired} required variables are missing`));
}

if (missingOptional > 0) {
  console.log(chalk.yellow(`⚠️  ${missingOptional} optional variables are not set`));
}

// Recommendations
console.log(chalk.blue('\n💡 Recommendations:'));
if (missingRequired > 0) {
  console.log(chalk.yellow('1. Set all required variables before deployment'));
}

if (missingOptional > 0) {
  console.log(
    chalk.yellow('2. Consider setting optional variables for better analytics and features')
  );
}

console.log(
  chalk.yellow('3. Keep environment variables secure and never commit them to version control')
);

// Final status
const totalMissing = missingRequired + missingOptional;
if (totalMissing === 0) {
  console.log(chalk.green('\n🎉 Environment configuration is ready for deployment!'));
  process.exit(0);
} else if (missingRequired === 0) {
  console.log(chalk.yellow('\n⚠️  Environment is ready but some optional features are disabled'));
  process.exit(0);
} else {
  console.log(chalk.red('\n❌ Environment configuration needs to be fixed before deployment'));
  process.exit(1);
}
