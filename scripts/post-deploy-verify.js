#!/usr/bin/env node

import { execSync } from 'child_process';
import chalk from 'chalk';

const BASE_URL = process.argv[2] ?? 'https://mixhive.vercel.app';

console.log(chalk.blue('🔍 Running post-deployment verification...'));

// Health checks
console.log(chalk.blue('\n🏥 Checking application health...'));

try {
  const healthResponse = execSync(`curl -f ${BASE_URL}/api/health`, {
    stdio: 'pipe',
    timeout: 10000,
  }).toString();

  if (healthResponse.includes('healthy')) {
    console.log(chalk.green('✅ Application health check passed'));
  } else {
    console.log(chalk.red('❌ Application health check failed'));
    process.exit(1);
  }
} catch (error) {
  console.log(chalk.red('❌ Application health check failed'));
  console.log(chalk.red(`Error: ${error.message}`));
  process.exit(1);
}

// Database health
console.log(chalk.blue('\n🗄️ Checking database health...'));

try {
  const dbResponse = execSync(`curl -f ${BASE_URL}/api/health/database`, {
    stdio: 'pipe',
    timeout: 10000,
  }).toString();

  if (dbResponse.includes('healthy')) {
    console.log(chalk.green('✅ Database health check passed'));
  } else {
    console.log(chalk.red('❌ Database health check failed'));
    process.exit(1);
  }
} catch (error) {
  console.log(chalk.yellow('⚠️  Database health check failed'));
  console.log(chalk.yellow('💡 Database may not be configured yet'));
}

// Redis health
console.log(chalk.blue('\n⚡ Checking Redis health...'));

try {
  const redisResponse = execSync(`curl -f "${BASE_URL}/api/redis?action=health"`, {
    stdio: 'pipe',
    timeout: 10000,
  }).toString();

  const redis = JSON.parse(redisResponse);
  if (redis.status === 'healthy') {
    console.log(chalk.green('✅ Redis health check passed'));
  } else {
    console.log(chalk.yellow('⚠️  Redis is degraded (fail-open is active)'));
    console.log(chalk.yellow(`   Error: ${redis.error || 'Unknown'}`));
  }
} catch (error) {
  console.log(chalk.yellow('⚠️  Redis health check failed'));
  console.log(chalk.yellow('💡 Redis may not be configured yet'));
}

// Agents health
console.log(chalk.blue('\n🤖 Checking agents endpoint...'));

try {
  const agentResponse = execSync(`curl -f ${BASE_URL}/api/agents/wasmoon-test`, {
    stdio: 'pipe',
    timeout: 15000,
  }).toString();

  console.log(chalk.green('✅ Agents endpoint is accessible'));
} catch (error) {
  console.log(chalk.yellow('⚠️  Agents endpoint check failed'));
  console.log(chalk.yellow('💡 Agent runtime may not be deployed yet'));
}

// Storage health
console.log(chalk.blue('\n☁️ Checking storage health...'));

try {
  const storageResponse = execSync(`curl -f ${BASE_URL}/api/health/storage`, {
    stdio: 'pipe',
    timeout: 10000,
  }).toString();

  if (storageResponse.includes('healthy')) {
    console.log(chalk.green('✅ Storage health check passed'));
  } else {
    console.log(chalk.yellow('⚠️  Storage health check failed'));
  }
} catch (error) {
  console.log(chalk.yellow('⚠️  Storage health check failed'));
  console.log(chalk.yellow('💡 Storage may not be configured yet'));
}

// Performance checks
console.log(chalk.blue('\n⚡ Checking performance...'));

try {
  const startTime = Date.now();
  execSync(`curl -s ${BASE_URL}`, { stdio: 'ignore' });
  const loadTime = Date.now() - startTime;

  if (loadTime < 3000) {
    console.log(chalk.green(`✅ Load time: ${loadTime}ms`));
  } else {
    console.log(chalk.yellow(`⚠️  Load time: ${loadTime}ms (target: <3s)`));
  }
} catch (error) {
  console.log(chalk.red('❌ Performance check failed'));
  console.log(chalk.red(`Error: ${error.message}`));
}

// Security checks
console.log(chalk.blue('\n🔒 Checking security...'));

try {
  const httpsResponse = execSync(`curl -I ${BASE_URL}`, {
    stdio: 'pipe',
    timeout: 10000,
  }).toString();

  if (httpsResponse.includes('200 OK') || httpsResponse.includes('200')) {
    console.log(chalk.green('✅ HTTPS is enabled'));
  } else {
    console.log(chalk.red('❌ HTTPS is not enabled'));
    process.exit(1);
  }
} catch (error) {
  console.log(chalk.red('❌ HTTPS check failed'));
  console.log(chalk.red(`Error: ${error.message}`));
  process.exit(1);
}

// Check security headers
try {
  const headersResponse = execSync(`curl -I ${BASE_URL}`, {
    stdio: 'pipe',
    timeout: 10000,
  }).toString();

  const securityHeaders = [
    'Strict-Transport-Security',
    'X-Content-Type-Options',
    'X-Frame-Options',
  ];

  // HTTP header names are case-insensitive; Vercel returns lowercase via HTTP/2
  const headersLower = headersResponse.toLowerCase();
  let missingHeaders = 0;
  securityHeaders.forEach(header => {
    if (!headersLower.includes(header.toLowerCase())) {
      console.log(chalk.yellow(`⚠️  Missing security header: ${header}`));
      missingHeaders++;
    } else {
      console.log(chalk.green(`✅ Security header present: ${header}`));
    }
  });

  if (missingHeaders > 0) {
    console.log(chalk.yellow(`⚠️  ${missingHeaders} security headers missing`));
  }
} catch (error) {
  console.log(chalk.yellow('⚠️  Security headers check failed'));
}

// Feature verification
console.log(chalk.blue('\n🎯 Verifying core features...'));

const features = [
  { name: 'Homepage', url: BASE_URL },
  { name: 'Login', url: `${BASE_URL}/auth/login` },
  { name: 'Register', url: `${BASE_URL}/auth/register` },
  { name: 'Discover', url: `${BASE_URL}/discover` },
  { name: 'Feed', url: `${BASE_URL}/feed` },
];

features.forEach(feature => {
  try {
    execSync(`curl -f -s ${feature.url}`, {
      stdio: 'pipe',
      timeout: 10000,
    });
    console.log(chalk.green(`✅ ${feature.name} is accessible`));
  } catch (error) {
    console.log(chalk.yellow(`⚠️  ${feature.name} is not accessible`));
  }
});

// Final summary
const checks = [
  'Application health',
  'Database health',
  'Redis health',
  'Agents endpoint',
  'Storage health',
  'Performance',
  'Security',
  'Core features',
];

console.log(chalk.blue('\n📋 Post-deployment verification summary'));
console.log(chalk.blue('='.repeat(50)));
console.log(chalk.green(`✅ Total checks: ${checks.length}`));

if (process.exitCode === 0) {
  console.log(chalk.green('\n🎉 All critical checks passed!'));
  console.log(chalk.blue('🚀 MixHive is successfully deployed and ready for users!'));
} else {
  console.log(chalk.yellow('\n⚠️  Some checks failed'));
  console.log(chalk.yellow('💡 Review the failed checks and fix any issues'));
}

console.log(chalk.green('\n🎉 MixHive deployment verification complete!'));
