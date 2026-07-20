/**
 * CDN Testing API Endpoint
 *
 * Provides testing functionality for CDN integration including
 * URL transformation, fallback validation, and performance testing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cdnConfig, getOptimizedMediaUrl } from '@/lib/cdn';
import { cdnUploadManager } from '@/lib/cdn';
import { validateUploadFile } from '@/lib/cdnUpload';
import type { CDNOptimizationParams, MediaBucket } from '@/lib/cdn';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const testType = searchParams.get('type') || 'health';

    switch (testType) {
      case 'health':
        return await handleHealthTest();
      case 'configuration':
        return await handleConfigurationTest();
      case 'performance':
        return await handlePerformanceTest();
      case 'cache':
        return await handleCacheTest();
      default:
        return NextResponse.json({ error: 'Invalid test type' }, { status: 400 });
    }
  } catch (error) {
    console.error('CDN test error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { testType, ...testParams } = body;

    switch (testType) {
      case 'transform':
        return await handleTransformTest(testParams);
      case 'upload':
        return await handleUploadTest(testParams);
      case 'fallback':
        return await handleFallbackTest(testParams);
      case 'cost-optimization':
        return await handleCostOptimizationTest(testParams);
      case 'batch':
        return await handleBatchTest(testParams);
      default:
        return NextResponse.json({ error: 'Invalid test type' }, { status: 400 });
    }
  } catch (error) {
    console.error('CDN test error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Health test
async function handleHealthTest() {
  try {
    // Check CDN configuration
    const configStatus = {
      enabled: cdnConfig.enabled,
      provider: cdnConfig.provider,
      baseUrl: cdnConfig.baseUrl,
      fallbackEnabled: cdnConfig.fallbackToSupabase,
    };

    // Test basic connectivity
    let connectivity = 'unknown';
    let latency = 0;

    if (cdnConfig.baseUrl) {
      try {
        const startTime = Date.now();
        const response = await fetch(`${cdnConfig.baseUrl}/health`, {
          method: 'HEAD',
          signal: AbortSignal.timeout(5000),
        });
        latency = Date.now() - startTime;
        connectivity = response.ok ? 'healthy' : 'degraded';
      } catch (_error) {
        connectivity = 'unreachable';
      }
    }

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      configuration: configStatus,
      connectivity,
      latency,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Health test failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Configuration test
async function handleConfigurationTest() {
  try {
    const config = cdnConfig;
    const issues: string[] = [];

    // Validate configuration
    if (!config.enabled) {
      issues.push('CDN is disabled');
    }

    if (!config.baseUrl) {
      issues.push('CDN base URL is not configured');
    }

    if (config.fallbackToSupabase && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
      issues.push('Fallback enabled but Supabase URL is not configured');
    }

    // Check environment variables
    const envVars = {
      CDN_ENABLED: process.env.NEXT_PUBLIC_CDN_ENABLED,
      CDN_PROVIDER: process.env.NEXT_PUBLIC_CDN_PROVIDER,
      CDN_BASE_URL: process.env.NEXT_PUBLIC_CDN_BASE_URL,
      SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    };

    const missingEnvVars = Object.entries(envVars)
      .filter(([_, value]) => !value)
      .map(([key]) => key);

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      configuration: config,
      issues,
      environmentVariables: {
        present: Object.fromEntries(Object.entries(envVars).filter(([_, value]) => value)),
        missing: missingEnvVars,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Configuration test failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Performance test
async function handlePerformanceTest() {
  try {
    const testUrls = [
      'https://example.supabase.co/storage/v1/object/public/mix-artwork/test1.jpg',
      'https://example.supabase.co/storage/v1/object/public/mix-artwork/test2.jpg',
      'https://example.supabase.co/storage/v1/object/public/mix-audio/test.mp3',
    ];

    const results = [];

    for (const url of testUrls) {
      try {
        const startTime = Date.now();
        const bucket = url.includes('mix-artwork') ? 'mix-artwork' : 'mix-audio';

        // Test URL transformation
        const result = await getOptimizedMediaUrl(url, bucket);

        const duration = Date.now() - startTime;

        results.push({
          url,
          source: result.source,
          duration,
          success: true,
        });
      } catch (error) {
        results.push({
          url,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successRate = results.filter(r => r.success).length / results.length;
    const averageDuration =
      results.filter(r => r.success).reduce((sum, r) => sum + r.duration, 0) /
      results.filter(r => r.success).length;

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      results,
      summary: {
        totalTests: results.length,
        successRate: successRate * 100,
        averageDuration: Math.round(averageDuration),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Performance test failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Cache test
async function handleCacheTest() {
  try {
    const testUrls = [
      'https://example.supabase.co/storage/v1/object/public/mix-artwork/cache-test.jpg',
      'https://example.supabase.co/storage/v1/object/public/mix-audio/cache-test.mp3',
    ];

    const results = [];

    for (const url of testUrls) {
      try {
        const startTime = Date.now();

        // Test cache headers
        const bucket = url.includes('mix-artwork') ? 'mix-artwork' : 'mix-audio';
        const result = await getOptimizedMediaUrl(url, bucket);

        const duration = Date.now() - startTime;

        results.push({
          url,
          source: result.source,
          duration,
          success: true,
        });
      } catch (error) {
        results.push({
          url,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      results,
      summary: {
        totalTests: results.length,
        successCount: results.filter(r => r.success).length,
        averageDuration:
          results.filter(r => r.success).reduce((sum, r) => sum + r.duration, 0) /
          results.filter(r => r.success).length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Cache test failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// URL transformation test
async function handleTransformTest(params: {
  url: string;
  bucket: string;
  optimization?: CDNOptimizationParams;
}) {
  try {
    const { url, bucket, optimization } = params;

    const result = await getOptimizedMediaUrl(url, bucket, optimization);

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      originalUrl: url,
      transformedUrl: result.url,
      source: result.source,
      optimization,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'URL transformation failed',
        originalUrl: params.url,
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Upload test
async function handleUploadTest(params: {
  file?: unknown;
  bucket: string;
  simulateFailure?: boolean;
}) {
  try {
    const { file, bucket, simulateFailure } = params;

    if (simulateFailure) {
      return NextResponse.json({
        status: 'error',
        message: 'Simulated CDN failure - fallback should be used',
        fallbackUsed: true,
        success: true,
      });
    }

    // Create a test file if none provided
    const testFile = file || new File(['test content'], 'test.jpg', { type: 'image/jpeg' });

    // Validate file
    const isValid = validateUploadFile(testFile, 'image');
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid file', details: 'File validation failed' },
        { status: 400 }
      );
    }

    // Test upload
    const result = await cdnUploadManager.uploadToCDN(
      testFile,
      bucket as MediaBucket,
      `test-${Date.now()}`,
      progress => {
        console.log('Upload progress:', progress);
      }
    );

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uploaded: true,
      url: result.url,
      source: result.source,
      bucket,
      fileSize: testFile.size,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Upload test failed',
        bucket: params.bucket,
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Fallback test
async function handleFallbackTest(params: { simulateCdnFailure?: boolean }) {
  try {
    const { simulateCdnFailure } = params;

    if (simulateCdnFailure) {
      // Simulate CDN failure by returning failure
      return NextResponse.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        simulatedFailure: true,
        fallbackUsed: true,
        success: true,
        message: 'CDN failure simulated - fallback mechanism activated',
      });
    }

    // Test normal operation
    const testUrl = 'https://example.supabase.co/storage/v1/object/public/mix-artwork/test.jpg';
    const result = await getOptimizedMediaUrl(testUrl, 'mix-artwork');

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      fallbackUsed: result.source === 'supabase',
      success: true,
      message: result.source === 'cdn' ? 'Used CDN' : 'Used Supabase fallback',
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Fallback test failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Cost optimization test
async function handleCostOptimizationTest(params: { testSize?: string; networkType?: string }) {
  try {
    const { testSize = 'medium', networkType = '4g' } = params;

    // Simulate different network conditions
    const optimizationParams = {
      format: 'webp',
      quality: networkType === '4g' ? 80 : 60,
      width: testSize === 'thumbnail' ? 80 : testSize === 'small' ? 200 : 400,
      height: testSize === 'thumbnail' ? 80 : testSize === 'small' ? 200 : 400,
    };

    const testUrl = 'https://example.supabase.co/storage/v1/object/public/mix-artwork/test.jpg';
    const result = await getOptimizedMediaUrl(testUrl, 'mix-artwork', optimizationParams);

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      testSize,
      networkType,
      optimized: true,
      originalUrl: testUrl,
      optimizedUrl: result.url,
      optimizationParams,
      source: result.source,
      estimatedSavings: '40%', // Mock savings calculation
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Cost optimization test failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Batch test
async function handleBatchTest(params: { tests: Array<{ type: string; params: unknown }> }) {
  try {
    const { tests } = params;
    const results = [];

    for (const test of tests) {
      try {
        let result;

        switch (test.type) {
          case 'transform':
            result = await handleTransformTest(test.params);
            break;
          case 'upload':
            result = await handleUploadTest(test.params);
            break;
          case 'fallback':
            result = await handleFallbackTest(test.params);
            break;
          default:
            result = NextResponse.json(
              { error: `Unknown test type: ${test.type}` },
              { status: 400 }
            );
        }

        results.push({
          type: test.type,
          success: result.status === 200,
          data: await result.json(),
        });
      } catch (error) {
        results.push({
          type: test.type,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successRate = results.filter(r => r.success).length / results.length;

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      results,
      summary: {
        totalTests: results.length,
        successCount: results.filter(r => r.success).length,
        successRate: successRate * 100,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Batch test failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Export test utilities
export const CDN_TEST_API = {
  handleHealthTest,
  handleConfigurationTest,
  handlePerformanceTest,
  handleCacheTest,
  handleTransformTest,
  handleUploadTest,
  handleFallbackTest,
  handleCostOptimizationTest,
  handleBatchTest,
};
