#!/usr/bin/env node

import { execSync } from 'child_process';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

console.log(chalk.blue('🚀 Starting MixHive production deployment...'));

// Deployment target
const deploymentTarget = process.env.DEPLOY_TARGET || 'vercel';

console.log(chalk.blue(`🎯 Deployment target: ${deploymentTarget}`));

// Check environment
const envFile = '.env.production';
const envPath = path.join(process.cwd(), envFile);

if (!fs.existsSync(envPath)) {
  console.log(chalk.red(`❌ Environment file not found: ${envFile}`));
  console.log(chalk.yellow('💡 Create this file from .env.example'));
  process.exit(1);
}

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

// Deploy based on target
switch (deploymentTarget) {
  case 'vercel':
    deployToVercel();
    break;
  case 'docker':
    deployToDocker();
    break;
  default:
    console.log(chalk.red(`❌ Unknown deployment target: ${deploymentTarget}`));
    process.exit(1);
}

function deployToVercel() {
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

    // Get deployment URL
    try {
      const output = execSync('vercel ls', { stdio: 'pipe' }).toString();
      const urlMatch = output.match(/https:\/\/[^.]+\.vercel\.app/);
      if (urlMatch) {
        console.log(chalk.blue(`🌐 Deployment URL: ${urlMatch[0]}`));
      }
    } catch (error) {
      console.log(chalk.yellow('⚠️  Could not get deployment URL'));
    }
  } catch (error) {
    console.log(chalk.red('❌ Deployment to Vercel failed'));
    console.log(chalk.red(error.message));
    process.exit(1);
  }

  // Post-deployment verification
  console.log(chalk.blue('🔍 Running post-deployment verification...'));

  try {
    execSync('node scripts/post-deploy-verify.js', { stdio: 'inherit' });
    console.log(chalk.green('✅ Post-deployment verification passed'));
  } catch (error) {
    console.log(chalk.yellow('⚠️  Post-deployment verification failed'));
    console.log(chalk.yellow('💡 Manual verification required'));
  }
}

function deployToDocker() {
  console.log(chalk.blue('\n🐳 Deploying with Docker...'));

  // Build Docker image
  console.log(chalk.blue('🔨 Building Docker image...'));

  try {
    execSync('docker build -t mixhive:latest .', { stdio: 'inherit' });
    console.log(chalk.green('✅ Docker image built successfully'));
  } catch (error) {
    console.log(chalk.red('❌ Docker build failed'));
    console.log(chalk.red(error.message));
    process.exit(1);
  }

  // Run Docker container
  console.log(chalk.blue('🚀 Starting Docker container...'));

  try {
    execSync(
      'docker run -d --name mixhive -p 3000:3000 --env-file .env.production mixhive:latest',
      {
        stdio: 'inherit',
      }
    );
    console.log(chalk.green('✅ Docker container started'));
    console.log(chalk.blue('🌐 Application available at: http://localhost:3000'));
  } catch (error) {
    console.log(chalk.red('❌ Failed to start Docker container'));
    console.log(chalk.red(error.message));
    process.exit(1);
  }

  // Post-deployment verification
  console.log(chalk.blue('🔍 Running post-deployment verification...'));

  try {
    execSync('curl -f http://localhost:3000/api/health', { stdio: 'ignore' });
    console.log(chalk.green('✅ Post-deployment verification passed'));
  } catch (error) {
    console.log(chalk.yellow('⚠️  Post-deployment verification failed'));
    console.log(chalk.yellow('💡 Manual verification required'));
  }
}

// Post-deployment setup
console.log(chalk.blue('\n🔧 Post-deployment setup...'));

// Set up monitoring
try {
  console.log(chalk.blue('📊 Setting up monitoring...'));
  execSync(
    'node -e "require(\\\"./src/lib/analytics\\\").analyticsTracker.trackAuthAction(\\\"deployment\\")"',
    {
      stdio: 'inherit',
    }
  );
  console.log(chalk.green('✅ Monitoring setup completed'));
} catch (error) {
  console.log(chalk.yellow('⚠️  Monitoring setup failed'));
}

// Set up health checks
try {
  console.log(chalk.blue('🏥 Setting up health checks...'));
  execSync('node -e "require(\\\"./src/lib/monitoring\\\").healthMonitor.runAllChecks()"', {
    stdio: 'inherit',
  });
  console.log(chalk.green('✅ Health checks setup completed'));
} catch (error) {
  console.log(chalk.yellow('⚠️  Health checks setup failed'));
}

// Final summary
console.log(chalk.blue('\n🎉 Production deployment complete!'));
console.log(chalk.blue('='.repeat(50)));

console.log(chalk.green('✅ MixHive is now live in production!'));
console.log(chalk.blue('\n📋 Next steps:'));

// Monitoring setup
console.log(chalk.yellow('1. Monitor application health and performance'));
console.log(chalk.yellow('2. Set up monitoring dashboards'));
console.log(chalk.yellow('3. Configure alerts and notifications'));
console.log(chalk.yellow('4. Set up automated backups'));
console.log(chalk.yellow('5. Monitor user feedback and analytics'));

// Maintenance
console.log(chalk.blue('\n🔧 Maintenance tasks:'));
console.log(chalk.yellow('• Daily: Health checks and performance monitoring'));
console.log(chalk.yellow('• Weekly: Security updates and performance optimization'));
console.log(chalk.yellow('• Monthly: Database maintenance and backups'));
console.log(chalk.yellow('• Quarterly: Infrastructure review and feature planning'));

// Success metrics
console.log(chalk.blue('\n📊 Success metrics to monitor:'));
console.log(chalk.yellow('• Uptime: 99.9%+'));
console.log(chalk.yellow('• Response time: <2s'));
console.log(chalk.yellow('• Error rate: <0.1%'));
console.log(chalk.yellow('• User growth: Track monthly active users'));
console.log(chalk.yellow('• Engagement: Track mix plays, shares, comments'));

console.log(chalk.green('\n🎉 MixHive is now live and ready for users!'));
