#!/usr/bin/env node

import redis from 'ioredis';

// Test Redis connection
async function testRedis() {
  console.log('🔍 Testing Redis connection...');

  let client = null;
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    console.log(`📡 Connecting to Redis: ${redisUrl}`);

    client = new Redis(redisUrl, {
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      connectTimeout: 5000,
      commandTimeout: 3000,
    });

    // Test connection
    await client.connect();
    console.log('✅ Redis connected successfully');

    // Test basic operations
    console.log('\n🧪 Testing basic operations...');

    // Set a test key
    const testKey = 'test:mixhive';
    const testValue = { message: 'Redis is working!', timestamp: Date.now() };

    await client.setex(testKey, 60, JSON.stringify(testValue));
    console.log('✅ Set test key with TTL');

    // Get the test key
    const getValue = await client.get(testKey);
    const parsedValue = JSON.parse(getValue);
    console.log('✅ Retrieved test key:', parsedValue.message);

    // Test increment
    await client.set('test:counter', 0);
    await client.incr('test:counter');
    const counterValue = await client.get('test:counter');
    console.log('✅ Counter test:', counterValue);

    // Test keys pattern
    const keys = await client.keys('test:*');
    console.log('✅ Keys pattern test:', keys.length, 'keys found');

    // Cleanup
    await client.del('test:mixhive', 'test:counter');
    console.log('✅ Cleanup completed');

    // Check memory usage
    const memoryInfo = await client.info('memory');
    console.log('💾 Memory info available');

    await client.quit();
    console.log('👋 Redis connection closed');

    return true;
  } catch (error) {
    console.error('❌ Redis test failed:', error.message);
    return false;
  } finally {
    // Ensure connection is closed
    if (client && client.status === 'ready') {
      await client.quit();
    }
  }
}

// Test rate limiter
async function testRateLimiter() {
  console.log('\n🚦 Testing rate limiter...');

  try {
    const { rateLimiter } = await import('./src/lib/rateLimiter.ts');

    const userId = 'test-user';
    const results = [];

    // Test rate limiting
    for (let i = 0; i < 5; i++) {
      const result = await rateLimiter.checkApiLimit(userId);
      results.push(result);
      console.log(`Request ${i + 1}:`, result);

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return results;
  } catch (error) {
    console.error('❌ Rate limiter test failed:', error.message);
    return [];
  }
}

// Run tests
async function main() {
  console.log('🚀 Starting MixHive Redis tests...\n');

  const redisSuccess = await testRedis();
  const rateLimitResults = await testRateLimiter();

  console.log('\n📊 Test Results:');
  console.log('Redis connection:', redisSuccess ? '✅ PASS' : '❌ FAIL');
  console.log('Rate limiter tests:', rateLimitResults.length > 0 ? '✅ PASS' : '❌ FAIL');

  if (redisSuccess && rateLimitResults.length > 0) {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('\n💥 Some tests failed!');
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

main();
