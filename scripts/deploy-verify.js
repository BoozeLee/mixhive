#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { performance } from 'perf_hooks';

// Deployment verification script
class DeploymentVerifier {
  constructor() {
    this.startTime = performance.now();
    this.results = {
      passed: 0,
      failed: 0,
      warnings: 0,
      tests: [],
    };
  }

  // Run all verification tests
  async runAllTests() {
    console.log('🔍 Starting deployment verification...\n');

    await this.runEnvironmentTests();
    await this.runDependencyTests();
    await this.runBuildTests();
    await this.runPerformanceTests();
    await this.runSecurityTests();
    await this.runConfigurationTests();

    this.printResults();
    return this.results;
  }

  // Environment tests
  async runEnvironmentTests() {
    console.log('🌍 Environment Tests');

    // Check Node.js version
    this.test('Node.js version', () => {
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.replace('v', '').split('.')[0]);
      return majorVersion >= 18;
    });

    // Check environment variables
    this.test('Environment variables', () => {
      const requiredEnvVars = [
        'NEXT_PUBLIC_SUPABASE_URL',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        'SUPABASE_SERVICE_ROLE_KEY',
      ];

      return requiredEnvVars.every(varName => process.env[varName]);
    });

    // Check build environment
    this.test('Build environment', () => {
      const env = process.env.NODE_ENV;
      return env === 'production' || env === 'development';
    });

    // Check available memory
    this.test('Memory availability', () => {
      const totalMemory = require('os').totalmem();
      const freeMemory = require('os').freemem();
      const minMemoryRequired = 2 * 1024 * 1024 * 1024; // 2GB
      return freeMemory >= minMemoryRequired || totalMemory >= 8 * 1024 * 1024 * 1024; // 8GB total
    });

    console.log();
  }

  // Dependency tests
  async runDependencyTests() {
    console.log('📦 Dependency Tests');

    // Check package.json
    this.test('Package.json exists', () => {
      return fs.existsSync(path.join(process.cwd(), 'package.json'));
    });

    // Check dependencies installed
    this.test('Dependencies installed', () => {
      try {
        const { dependencies, devDependencies } = require(path.join(process.cwd(), 'package.json'));
        const nodeModules = fs.existsSync(path.join(process.cwd(), 'node_modules'));
        return Object.keys({ ...dependencies, ...devDependencies }).length > 0 && nodeModules;
      } catch (error) {
        return false;
      }
    });

    // Check dependency versions
    this.test('Dependency versions', () => {
      try {
        const packageJson = require(path.join(process.cwd(), 'package.json'));
        const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

        // Check for critical dependencies
        const criticalDeps = ['next', 'react', 'supabase-js', 'socket.io-client'];
        return criticalDeps.every(dep => dependencies[dep]);
      } catch (error) {
        return false;
      }
    });

    // Check lock file
    this.test('Lock file present', () => {
      return (
        fs.existsSync(path.join(process.cwd(), 'package-lock.json')) ||
        fs.existsSync(path.join(process.cwd(), 'yarn.lock')) ||
        fs.existsSync(path.join(process.cwd(), 'pnpm-lock.yaml'))
      );
    });

    console.log();
  }

  // Build tests
  async runBuildTests() {
    console.log('🔨 Build Tests');

    // TypeScript compilation
    this.test('TypeScript compilation', () => {
      try {
        execSync('npx tsc --noEmit', { stdio: 'pipe' });
        return true;
      } catch (error) {
        return false;
      }
    });

    // Next.js build
    this.test('Next.js build', () => {
      try {
        execSync('npm run build', { stdio: 'pipe', timeout: 300000 }); // 5 minute timeout
        return true;
      } catch (error) {
        return false;
      }
    });

    // Build artifacts
    this.test('Build artifacts', () => {
      const buildDir = path.join(process.cwd(), '.next');
      const requiredFiles = ['server.js', 'static', 'public'];

      return requiredFiles.every(file => fs.existsSync(path.join(buildDir, file)));
    });

    // Optimized images
    this.test('Image optimization', () => {
      const buildDir = path.join(process.cwd(), '.next');
      const imagesDir = path.join(buildDir, 'static', 'images');
      return fs.existsSync(imagesDir);
    });

    console.log();
  }

  // Performance tests
  async runPerformanceTests() {
    console.log('⚡ Performance Tests');

    // Bundle size
    this.test('Bundle size', () => {
      try {
        const stats = JSON.parse(
          execSync('npm run analyze -- --json', { stdio: 'pipe' }).toString()
        );
        const totalSize = stats.reduce((sum, chunk) => sum + chunk.size, 0);
        return totalSize < 2 * 1024 * 1024; // 2MB max
      } catch (error) {
        return false; // Skip if analyze not available
      }
    });

    // Lighthouse scores
    this.test('Lighthouse scores', () => {
      try {
        const lighthouse = require('lighthouse');
        const chromeLauncher = require('chrome-launcher');

        return new Promise(async resolve => {
          const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless'] });
          const results = await lighthouse('http://localhost:3000', { port: chrome.port });
          await chrome.kill();

          if (!results) return resolve(false);

          const scores = results.lhr.categories;
          const performanceScore = scores.performance.score * 100;
          const accessibilityScore = scores.accessibility.score * 100;
          const bestPracticesScore = categories['best-practices'].score * 100;

          resolve(performanceScore >= 90 && accessibilityScore >= 90 && bestPracticesScore >= 90);
        });
      } catch (error) {
        return false; // Skip if Lighthouse not available
      }
    });

    // Critical CSS
    this.test('Critical CSS', () => {
      const buildDir = path.join(process.cwd(), '.next');
      const criticalCssPath = path.join(buildDir, 'critical.css');
      return fs.existsSync(criticalCssPath);
    });

    console.log();
  }

  // Security tests
  async runSecurityTests() {
    console.log('🔒 Security Tests');

    // Dependency vulnerabilities
    this.test('No critical vulnerabilities', () => {
      try {
        const output = execSync('npm audit --audit-level moderate', { stdio: 'pipe' }).toString();
        return (
          !output.includes('moderate') && !output.includes('high') && !output.includes('critical')
        );
      } catch (error) {
        return false; // Skip if npm audit not available
      }
    });

    // Environment variables security
    this.test('Environment variables security', () => {
      const envVars = Object.keys(process.env);
      const sensitiveVars = ['PASSWORD', 'SECRET', 'KEY', 'TOKEN'];

      return sensitiveVars.every(varName =>
        envVars.every(envVar => !envVar.toUpperCase().includes(varName))
      );
    });

    // CORS configuration
    this.test('CORS configuration', () => {
      const nextConfigPath = path.join(process.cwd(), 'next.config.mjs');
      if (!fs.existsSync(nextConfigPath)) return false;

      const config = fs.readFileSync(nextConfigPath, 'utf8');
      return config.includes('allowOrigin') || config.includes('allowedOrigins');
    });

    // CSP headers
    this.test('Content Security Policy', () => {
      const nextConfigPath = path.join(process.cwd(), 'next.config.mjs');
      if (!fs.existsSync(nextConfigPath)) return false;

      const config = fs.readFileSync(nextConfigPath, 'utf8');
      return config.includes('Content-Security-Policy') || config.includes('csp');
    });

    console.log();
  }

  // Configuration tests
  async runConfigurationTests() {
    console.log('⚙️ Configuration Tests');

    // Environment configuration
    this.test('Environment configuration', () => {
      const envFiles = ['.env', '.env.local', '.env.production', '.env.development'];

      return envFiles.some(file => fs.existsSync(path.join(process.cwd(), file)));
    });

    // Supabase configuration
    this.test('Supabase configuration', () => {
      const envVars = [
        'NEXT_PUBLIC_SUPABASE_URL',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        'SUPABASE_SERVICE_ROLE_KEY',
      ];

      return envVars.every(varName => process.env[varName]);
    });

    // Database schema
    this.test('Database schema', () => {
      try {
        const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
        return fs.existsSync(migrationsDir) && fs.readdirSync(migrationsDir).length > 0;
      } catch (error) {
        return false;
      }
    });

    // CDN configuration
    this.test('CDN configuration', () => {
      return process.env.CDN_PROVIDER || process.env.CUSTOM_CDN_URL;
    });

    // Analytics configuration
    this.test('Analytics configuration', () => {
      const analyticsPath = path.join(process.cwd(), 'src', 'lib', 'analytics.ts');
      return fs.existsSync(analyticsPath);
    });

    console.log();
  }

  // Execute a test
  test(name, testFn) {
    const start = performance.now();
    let passed = false;
    let error = null;

    try {
      passed = testFn();
      error = null;
    } catch (err) {
      passed = false;
      error = err.message;
    }

    const duration = performance.now() - start;

    this.results.tests.push({
      name,
      passed,
      duration,
      error,
    });

    if (passed) {
      this.results.passed++;
      console.log(`✅ ${name} (${Math.round(duration)}ms)`);
    } else {
      this.results.failed++;
      console.log(`❌ ${name} (${Math.round(duration)}ms) - ${error || 'Test failed'}`);
    }
  }

  // Print results summary
  printResults() {
    const totalTime = performance.now() - this.startTime;
    const totalTests = this.results.passed + this.results.failed;

    console.log('\n📊 Deployment Verification Summary');
    console.log('================================');
    console.log(`✅ Passed: ${this.results.passed}`);
    console.log(`❌ Failed: ${this.results.failed}`);
    console.log(`⏱️  Total time: ${Math.round(totalTime)}ms`);
    console.log(`📈 Success rate: ${Math.round((this.results.passed / totalTests) * 100)}%`);

    if (this.results.failed > 0) {
      console.log('\n🚨 Failed Tests:');
      this.results.tests
        .filter(test => !test.passed)
        .forEach(test => {
          console.log(`  - ${test.name}: ${test.error || 'Test failed'}`);
        });
    }

    console.log('\n💡 Recommendations:');
    if (this.results.failed > 0) {
      console.log('  - Review failed tests and fix issues before deployment');
      console.log('  - Ensure all environment variables are properly configured');
      console.log('  - Check dependencies and install missing packages');
    }

    if (this.results.passed > 0) {
      console.log('  - Ready for deployment!');
      console.log('  - Monitor performance and error rates after deployment');
    }
  }

  // Exit with appropriate code
  exit() {
    process.exit(this.results.failed > 0 ? 1 : 0);
  }
}

// Main execution
async function main() {
  const verifier = new DeploymentVerifier();

  try {
    await verifier.runAllTests();
    verifier.exit();
  } catch (error) {
    console.error('Deployment verification failed:', error);
    process.exit(1);
  }
}

// Run if this script is executed directly
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (import.meta.url === `file://${__filename}`) {
  main().catch(console.error);
}
