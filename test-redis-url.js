// Test Redis URL parsing
const redisUrl =
  'redis://default:A1v17eh5bcpmlq5chncm5ds6csv8cmms3bqrp2jb9jytyas6al6@redis-17135.c291.us-east-1-1.ec2.cloud.redislabs.com:17135';

console.log('Redis URL:', redisUrl);

// Parse the URL
const url = new URL(redisUrl);
console.log('Protocol:', url.protocol);
console.log('Username:', url.username);
console.log('Password:', url.password);
console.log('Hostname:', url.hostname);
console.log('Port:', url.port);
console.log('Host:', url.host);

// Test if we can resolve the hostname
import dns from 'dns';

dns.lookup(url.hostname, (err, address, family) => {
  if (err) {
    console.error('DNS lookup failed:', err.message);
  } else {
    console.log(`DNS resolved to ${address} (IPv${family})`);
  }
});
