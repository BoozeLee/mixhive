// Simple Redis connection test
import Redis from 'ioredis';

async function test() {
  console.log('🔍 Testing Redis connection...');

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  console.log(`📡 Connecting to Redis: ${redisUrl}`);

  const client = new Redis({
    url: redisUrl,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    connectTimeout: 5000,
    commandTimeout: 3000,
  });

  try {
    await client.connect();
    console.log('✅ Redis connected successfully');

    // Test basic operations
    console.log('\n🧪 Testing basic operations...');

    const testKey = 'test:mixhive';
    const testValue = JSON.stringify({ message: 'Redis is working!', timestamp: Date.now() });

    await client.setex(testKey, 60, testValue);
    console.log('✅ Set test key with TTL');

    const getValue = await client.get(testKey);
    console.log('✅ Retrieved test key');

    await client.del(testKey);
    console.log('✅ Cleanup completed');

    console.log('\n🎉 Redis test passed!');
    return true;
  } catch (error) {
    console.error('❌ Redis test failed:', error.message);
    return false;
  } finally {
    if (client.status === 'ready') {
      await client.quit();
    }
  }
}

test()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
