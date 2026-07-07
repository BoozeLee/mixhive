/**
 * CDN Testing and Validation Utilities
 *
 * Provides comprehensive testing tools for CDN integration,
 * including performance tests, fallback validation, and monitoring.
 */

import { cdnConfig } from './cdn';
import { cdnHealthMonitor } from './cdnHealth';
import { cdnCostOptimizer } from './cdnCostOptimization';

interface TestCase {
  id: string;
  name: string;
  description: string;
  category: 'performance' | 'fallback' | 'optimization' | 'upload' | 'cache';
  execute: () => Promise<TestCaseResult>;
  timeout?: number;
}

interface TestCaseResult {
  passed: boolean;
  duration: number;
  message: string;
  details?: unknown;
  error?: Error;
}

interface TestSuite {
  name: string;
  testCases: TestCase[];
  beforeAll?: () => Promise<void>;
  afterAll?: () => Promise<void>;
}

interface TestReport {
  suiteName: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  results: TestCaseResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
  recommendations: string[];
}

interface PerformanceMetrics {
  loadTime: number;
  cacheHitRate: number;
  bandwidthUsage: number;
  errorRate: number;
  availability: number;
}

interface UploadTestConfig {
  fileSize: number;
  concurrentUploads: number;
  retryAttempts: number;
  expectedFormats: string[];
  timeout: number;
}

// Test cases for CDN functionality
const CDN_TEST_CASES: TestCase[] = [
  {
    id: 'cdn-connection',
    name: 'CDN Connection Test',
    description: 'Test CDN endpoint connectivity and response time',
    category: 'performance',
    timeout: 10000,
    execute: async () => {
      const startTime = Date.now();

      try {
        const health = await cdnHealthMonitor.getHealthStatus();
        const duration = Date.now() - startTime;

        if (health instanceof Map) {
          const statuses = Array.from(health.values());
          const allHealthy = statuses.every(status => status.status === 'healthy');

          return {
            passed: allHealthy,
            duration,
            message: `CDN health check completed in ${duration}ms`,
            details: { statuses },
          };
        } else {
          return {
            passed: health.status === 'healthy',
            duration,
            message: `CDN health check: ${health.status}`,
            details: { health },
          };
        }
      } catch (error) {
        return {
          passed: false,
          duration: Date.now() - startTime,
          message: 'CDN connection failed',
          error: error as Error,
        };
      }
    },
  },
  {
    id: 'cdn-url-transformation',
    name: 'CDN URL Transformation Test',
    description: 'Test CDN URL generation and transformation',
    category: 'optimization',
    execute: async () => {
      const testUrl = 'https://example.supabase.co/storage/v1/object/public/mix-artwork/test.jpg';
      const startTime = Date.now();

      try {
        // Test URL transformation
        const { url: transformedUrl, source } = await fetch('/api/cdn/transform', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: testUrl, bucket: 'mix-artwork' }),
        }).then(res => res.json());

        const duration = Date.now() - startTime;

        return {
          passed: transformedUrl && source,
          duration,
          message: `URL transformation successful via ${source}`,
          details: { originalUrl: testUrl, transformedUrl, source },
        };
      } catch (error) {
        return {
          passed: false,
          duration: Date.now() - startTime,
          message: 'URL transformation failed',
          error: error as Error,
        };
      }
    },
  },
  {
    id: 'cdn-fallback-mechanism',
    name: 'CDN Fallback Mechanism Test',
    description: 'Test fallback to Supabase when CDN is unavailable',
    category: 'fallback',
    execute: async () => {
      const startTime = Date.now();

      try {
        // Simulate CDN failure
        const result = await fetch('/api/cdn/test-fallback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ simulateCdnFailure: true }),
        }).then(res => res.json());

        const duration = Date.now() - startTime;

        return {
          passed: result.fallbackUsed && result.success,
          duration,
          message: `Fallback mechanism ${result.fallbackUsed ? 'activated' : 'not needed'}`,
          details: result,
        };
      } catch (error) {
        return {
          passed: false,
          duration: Date.now() - startTime,
          message: 'Fallback mechanism test failed',
          error: error as Error,
        };
      }
    },
  },
  {
    id: 'cdn-upload-test',
    name: 'CDN Upload Test',
    description: 'Test file upload to CDN with progress tracking',
    category: 'upload',
    timeout: 30000,
    execute: async () => {
      const startTime = Date.now();
      const testFile = new File(['test content'], 'test.jpg', { type: 'image/jpeg' });

      try {
        const result = await fetch('/api/cdn/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file: testFile, bucket: 'mix-artwork' }),
        }).then(res => res.json());

        const duration = Date.now() - startTime;

        return {
          passed: result.uploaded && result.url,
          duration,
          message: `Upload ${result.uploaded ? 'successful' : 'failed'}`,
          details: result,
        };
      } catch (error) {
        return {
          passed: false,
          duration: Date.now() - startTime,
          message: 'Upload test failed',
          error: error as Error,
        };
      }
    },
  },
  {
    id: 'cdn-cache-validation',
    name: 'CDN Cache Validation Test',
    description: 'Test CDN caching behavior and cache headers',
    category: 'cache',
    execute: async () => {
      const startTime = Date.now();

      try {
        // Test cache headers
        const response = await fetch('/api/cdn/test-cache', {
          method: 'HEAD',
        });

        const cacheControl = response.headers.get('Cache-Control');
        const cdnCacheKey = response.headers.get('CDN-Cache-Key');

        const duration = Date.now() - startTime;

        return {
          passed: !!cacheControl && !!cdnCacheKey,
          duration,
          message: `Cache headers validated`,
          details: { cacheControl, cdnCacheKey },
        };
      } catch (error) {
        return {
          passed: false,
          duration: Date.now() - startTime,
          message: 'Cache validation failed',
          error: error as Error,
        };
      }
    },
  },
  {
    id: 'cdn-cost-optimization',
    name: 'CDN Cost Optimization Test',
    description: 'Test cost optimization features and lazy loading',
    category: 'optimization',
    execute: async () => {
      const startTime = Date.now();

      try {
        const result = await fetch('/api/cdn/test-cost-optimization', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ testSize: 'thumbnail', networkType: '4g' }),
        }).then(res => res.json());

        const duration = Date.now() - startTime;

        return {
          passed: result.optimized && result.optimizedUrl,
          duration,
          message: `Cost optimization ${result.optimized ? 'applied' : 'not needed'}`,
          details: result,
        };
      } catch (error) {
        return {
          passed: false,
          duration: Date.now() - startTime,
          message: 'Cost optimization test failed',
          error: error as Error,
        };
      }
    },
  },
];

// Test suites
const CDN_TEST_SUITES: TestSuite[] = [
  {
    name: 'CDN Integration Suite',
    testCases: CDN_TEST_CASES,
    beforeAll: async () => {
      // Initialize CDN health monitoring
      cdnHealthMonitor.startMonitoring();
      console.log('CDN Health monitoring started');
    },
    afterAll: async () => {
      // Stop CDN health monitoring
      cdnHealthMonitor.stopMonitoring();
      console.log('CDN Health monitoring stopped');
    },
  },
  {
    name: 'CDN Performance Suite',
    testCases: CDN_TEST_CASES.filter(test => test.category === 'performance'),
  },
  {
    name: 'CDN Fallback Suite',
    testCases: CDN_TEST_CASES.filter(test => test.category === 'fallback'),
  },
  {
    name: 'CDN Optimization Suite',
    testCases: CDN_TEST_CASES.filter(test => test.category === 'optimization'),
  },
];

class CDNTester {
  private testSuites: TestSuite[];
  private results: Map<string, TestReport> = new Map();

  constructor(testSuites: TestSuite[] = CDN_TEST_SUITES) {
    this.testSuites = testSuites;
  }

  // Run a single test case
  async runTestCase(testCase: TestCase): Promise<TestCaseResult> {
    const startTime = Date.now();

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        if (testCase.timeout) {
          setTimeout(() => reject(new Error('Test timeout')), testCase.timeout);
        }
      });

      const testPromise = testCase.execute();
      const result = await Promise.race([testPromise, timeoutPromise]);

      return {
        ...result,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        passed: false,
        duration: Date.now() - startTime,
        message: 'Test execution failed',
        error: error as Error,
      };
    }
  }

  // Run a test suite
  async runTestSuite(suiteName: string): Promise<TestReport> {
    const suite = this.testSuites.find(s => s.name === suiteName);
    if (!suite) {
      throw new Error(`Test suite not found: ${suiteName}`);
    }

    const startTime = new Date();
    const results: TestCaseResult[] = [];

    try {
      // Run beforeAll hook
      if (suite.beforeAll) {
        await suite.beforeAll();
      }

      // Run all test cases
      for (const testCase of suite.testCases) {
        console.log(`Running test: ${testCase.name}`);
        const result = await this.runTestCase(testCase);
        results.push(result);

        // Log result
        console.log(
          `Test ${testCase.name}: ${result.passed ? 'PASSED' : 'FAILED'} in ${result.duration}ms`
        );
      }

      // Run afterAll hook
      if (suite.afterAll) {
        await suite.afterAll();
      }
    } catch (error) {
      console.error('Test suite execution failed:', error);
    }

    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();

    const summary = {
      total: results.length,
      passed: results.filter(r => r.passed).length,
      failed: results.filter(r => !r.passed).length,
      skipped: 0,
    };

    const recommendations = this.generateRecommendations(results);

    const report: TestReport = {
      suiteName,
      startTime,
      endTime,
      duration,
      results,
      summary,
      recommendations,
    };

    this.results.set(suiteName, report);
    return report;
  }

  // Run all test suites
  async runAllTestSuites(): Promise<Map<string, TestReport>> {
    const results = new Map<string, TestReport>();

    for (const suite of this.testSuites) {
      console.log(`Running test suite: ${suite.name}`);
      const report = await this.runTestSuite(suite.name);
      results.set(suite.name, report);
    }

    return results;
  }

  // Generate recommendations based on test results
  private generateRecommendations(results: TestCaseResult[]): string[] {
    const recommendations: string[] = [];

    // Analyze results
    const passedTests = results.filter(r => r.passed).length;
    const totalTests = results.length;
    const passRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;

    if (passRate < 90) {
      recommendations.push('Consider improving CDN configuration or checking network connectivity');
    }

    const failedTests = results.filter(r => !r.passed);

    failedTests.forEach(test => {
      if (test.message.includes('connection') || test.message.includes('timeout')) {
        recommendations.push('Network connectivity issues detected - check CDN provider status');
      }

      if (test.message.includes('fallback')) {
        recommendations.push('Fallback mechanism activated - verify CDN provider configuration');
      }

      if (test.message.includes('upload')) {
        recommendations.push('Upload performance issues detected - check CDN upload limits');
      }

      if (test.message.includes('cache')) {
        recommendations.push('Cache configuration may need optimization - review cache headers');
      }
    });

    if (recommendations.length === 0) {
      recommendations.push('All tests passed - CDN integration is working correctly');
    }

    return recommendations;
  }

  // Get test results for a specific suite
  getTestResults(suiteName?: string): TestReport | Map<string, TestReport> {
    if (suiteName) {
      return this.results.get(suiteName)!;
    }
    return this.results;
  }

  // Get performance metrics
  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    const _healthStatus = cdnHealthMonitor.getHealthStatus();
    const bandwidthMetrics = cdnCostOptimizer.getBandwidthMetrics();

    return {
      loadTime: this.calculateAverageLoadTime(),
      cacheHitRate: this.calculateCacheHitRate(),
      bandwidthUsage: bandwidthMetrics.currentBandwidthGB,
      errorRate: this.calculateErrorRate(),
      availability: this.calculateAvailability(),
    };
  }

  // Calculate average load time
  private calculateAverageLoadTime(): number {
    const allResults = Array.from(this.results.values()).flatMap(r => r.results);
    const loadTimes = allResults.map(r => r.duration);
    return loadTimes.length > 0 ? loadTimes.reduce((a, b) => a + b, 0) / loadTimes.length : 0;
  }

  // Calculate cache hit rate
  private calculateCacheHitRate(): number {
    // Mock implementation - in real scenario, this would track actual cache hits
    return 85; // Assume 85% cache hit rate
  }

  // Calculate error rate
  private calculateErrorRate(): number {
    const allResults = Array.from(this.results.values()).flatMap(r => r.results);
    const failedResults = allResults.filter(r => !r.passed);
    return allResults.length > 0 ? (failedResults.length / allResults.length) * 100 : 0;
  }

  // Calculate availability
  private calculateAvailability(): number {
    const healthStatus = cdnHealthMonitor.getHealthStatus();
    if (healthStatus instanceof Map) {
      const statuses = Array.from(healthStatus.values());
      const healthyCount = statuses.filter(s => s.status === 'healthy').length;
      return (healthyCount / statuses.length) * 100;
    }
    return healthStatus.status === 'healthy' ? 100 : 0;
  }

  // Validate CDN configuration
  validateConfiguration(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!cdnConfig.enabled) {
      errors.push('CDN is disabled - uploads will use Supabase directly');
    }

    if (!cdnConfig.baseUrl) {
      errors.push('CDN base URL is not configured');
    }

    if (cdnConfig.fallbackToSupabase && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
      errors.push('Fallback to Supabase is enabled but Supabase URL is not configured');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // Generate test report
  generateReport(): string {
    const reports = Array.from(this.results.values());

    let report = '# CDN Integration Test Report\n\n';
    report += `Generated: ${new Date().toISOString()}\n\n`;

    reports.forEach(suiteReport => {
      report += `## ${suiteReport.suiteName}\n\n`;
      report += `Duration: ${suiteReport.duration}ms\n`;
      report += `Summary: ${suiteReport.summary.passed}/${suiteReport.summary.total} tests passed\n\n`;

      report += '### Results:\n';
      suiteReport.results.forEach(result => {
        const status = result.passed ? '✅ PASS' : '❌ FAIL';
        report += `- ${status} ${result.name} (${result.duration}ms)\n`;
        report += `  ${result.message}\n`;
        if (result.error) {
          report += `  Error: ${result.error.message}\n`;
        }
      });

      report += '\n### Recommendations:\n';
      suiteReport.recommendations.forEach(rec => {
        report += `- ${rec}\n`;
      });

      report += '\n---\n\n';
    });

    return report;
  }

  // Export results to file
  exportResults(format: 'json' | 'csv' | 'html' = 'json'): string {
    const reports = Array.from(this.results.values());

    switch (format) {
      case 'json':
        return JSON.stringify(reports, null, 2);

      case 'csv': {
        let csv = 'Suite Name,Test Name,Status,Duration,Message\n';
        reports.forEach(suite => {
          suite.results.forEach(result => {
            csv += `${suite.suiteName},"${result.name}",${result.passed ? 'PASS' : 'FAIL'},${result.duration},"${result.message}"\n`;
          });
        });
        return csv;
      }

      case 'html':
        return this.generateHTMLReport(reports);

      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  // Generate HTML report
  private generateHTMLReport(reports: TestReport[]): string {
    let html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CDN Integration Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .suite { margin-bottom: 30px; border: 1px solid #ddd; border-radius: 8px; padding: 20px; }
        .test { margin: 10px 0; padding: 10px; border-left: 4px solid #ddd; }
        .test.pass { border-left-color: #22c55e; }
        .test.fail { border-left-color: #ef4444; }
        .summary { background: #f3f4f6; padding: 15px; border-radius: 6px; margin-bottom: 20px; }
        .recommendations { background: #fef3c7; padding: 15px; border-radius: 6px; }
    </style>
</head>
<body>
    <h1>CDN Integration Test Report</h1>
    <p>Generated: ${new Date().toISOString()}</p>
`;

    reports.forEach(suite => {
      html += `
    <div class="suite">
        <h2>${suite.suiteName}</h2>
        <div class="summary">
            <p><strong>Duration:</strong> ${suite.duration}ms</p>
            <p><strong>Summary:</strong> ${suite.summary.passed}/${suite.summary.total} tests passed</p>
        </div>
`;

      suite.results.forEach(result => {
        const statusClass = result.passed ? 'pass' : 'fail';
        html += `
        <div class="test ${statusClass}">
            <h3>${result.name} (${result.duration}ms)</h3>
            <p>${result.message}</p>
            ${result.error ? `<p><strong>Error:</strong> ${result.error.message}</p>` : ''}
        </div>`;
      });

      html += `
        <div class="recommendations">
            <h3>Recommendations</h3>
            <ul>
                ${suite.recommendations.map(rec => `<li>${rec}</li>`).join('')}
            </ul>
        </div>
    </div>`;
    });

    html += `
</body>
</html>`;

    return html;
  }
}

// Global tester instance
export const cdnTester = new CDNTester();

// Utility functions
export const runCDNTests = async (
  suiteName?: string
): Promise<TestReport | Map<string, TestReport>> => {
  if (suiteName) {
    return await cdnTester.runTestSuite(suiteName);
  }
  return await cdnTester.runAllTestSuites();
};

export const getCDNTestResults = (suiteName?: string) => {
  return cdnTester.getTestResults(suiteName);
};

export const validateCDNConfiguration = () => {
  return cdnTester.validateConfiguration();
};

export const generateCDNTestReport = (format: 'json' | 'csv' | 'html' = 'json') => {
  return cdnTester.exportResults(format);
};

export const getCDNPerformanceMetrics = async () => {
  return await cdnTester.getPerformanceMetrics();
};

// Test helpers for development
export const createTestFile = (size: number = 1024): File => {
  const content = new Array(size).fill('a').join('');
  return new File([content], 'test-file.jpg', { type: 'image/jpeg' });
};

export const simulateNetworkConditions = (type: 'slow' | 'fast' | 'offline'): void => {
  if (typeof window !== 'undefined' && window.navigator) {
    // Mock network conditions for testing
    console.log(`Simulating network conditions: ${type}`);
  }
};

// Export types and constants
export type {
  TestCase,
  TestCaseResult,
  TestSuite,
  TestReport,
  PerformanceMetrics,
  UploadTestConfig,
};
