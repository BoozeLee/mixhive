#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import chalk from 'chalk';

console.log(chalk.blue('🌐 Setting up MixHive CDN...'));

// Read environment configuration
const envPath = path.join(process.cwd(), '.env.production');
if (!fs.existsSync(envPath)) {
  console.log(chalk.red('❌ Production environment file not found'));
  console.log(chalk.yellow('💡 Create .env.production from .env.example'));
  process.exit(1);
}

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

// Get CDN provider from environment
const cdnProvider = envVars.CDN_PROVIDER || 'cloudflare';

console.log(chalk.blue(`📡 CDN Provider: ${cdnProvider}`));

// Set up CDN based on provider
switch (cdnProvider) {
  case 'cloudflare':
    setupCloudflareCDN(envVars);
    break;
  case 'aws':
    setupAWSCDN(envVars);
    break;
  case 'custom':
    setupCustomCDN(envVars);
    break;
  default:
    console.log(chalk.red(`❌ Unknown CDN provider: ${cdnProvider}`));
    process.exit(1);
}

function setupCloudflareCDN(envVars) {
  console.log(chalk.blue('\n☁️ Setting up Cloudflare CDN...'));

  // Check if Cloudflare CLI is installed
  try {
    execSync('cloudflare --version', { stdio: 'ignore' });
    console.log(chalk.green('✅ Cloudflare CLI found'));
  } catch (error) {
    console.log(chalk.red('❌ Cloudflare CLI not found'));
    console.log(chalk.yellow('💡 Install with: npm install -g cloudflare-cli'));
    process.exit(1);
  }

  // Create Cloudflare configuration
  const cloudflareConfig = {
    api: {
      token: envVars.CLOUDFLARE_API_TOKEN || '',
      email: envVars.CLOUDFLARE_EMAIL || '',
      zone: envVars.CLOUDFLARE_ZONE_ID || '',
    },
    domains: [envVars.NEXT_PUBLIC_CDN_BASE_URL.replace('https://', '')],
    settings: {
      securityLevel: 'medium',
      cacheLevel: 'aggressive',
      developmentMode: false,
      securityHeaders: {
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      },
    },
  };

  // Save Cloudflare configuration
  const configPath = path.join(process.cwd(), 'cloudflare.json');
  fs.writeFileSync(configPath, JSON.stringify(cloudflareConfig, null, 2));
  console.log(chalk.green('✅ Cloudflare configuration created'));

  // Create Cloudflare rules
  const cloudflareRules = [
    {
      name: 'Block malicious bots',
      phase: 'http_request_firewall_managed',
      action: 'block',
      expressions: ['cf.client.bot_management.score > 30'],
    },
    {
      name: 'Cache static assets',
      phase: 'http_request_cache_settings',
      action: 'cache',
      expressions: [
        'http.request.uri.path contains ".js" or http.request.uri.path contains ".css" or http.request.uri.path contains ".png" or http.request.uri.path contains ".jpg" or http.request.uri.path contains ".svg"',
      ],
      cache_key: {
        cache_deception_armor: 'off',
        custom_key: [
          'cookie:"__cf_bm"',
          'cookie:"auth"',
          'header:Origin',
          'header:Referer',
          'header:User-Agent',
        ],
        ignore_query_strings: true,
      },
      cache_ttl: {
        default: '1d',
      },
    },
    {
      name: 'Cache images',
      phase: 'http_request_cache_settings',
      action: 'cache',
      expressions: ['http.request.uri.path contains "/images/"'],
      cache_key: {
        custom_key: ['cookie:"__cf_bm"', 'header:Origin', 'header:Referer'],
        ignore_query_strings: true,
      },
      cache_ttl: {
        default: '7d',
      },
    },
    {
      name: 'Cache audio files',
      phase: 'http_request_cache_settings',
      action: 'cache',
      expressions: ['http.request.uri.path contains "/audio/"'],
      cache_key: {
        custom_key: ['cookie:"__cf_bm"', 'header:Origin', 'header:Referer'],
        ignore_query_strings: true,
      },
      cache_ttl: {
        default: '30d',
      },
    },
  ];

  // Save Cloudflare rules
  const rulesPath = path.join(process.cwd(), 'cloudflare-rules.json');
  fs.writeFileSync(rulesPath, JSON.stringify(cloudflareRules, null, 2));
  console.log(chalk.green('✅ Cloudflare rules created'));

  // Create Cloudflare DNS configuration
  const dnsConfig = {
    records: [
      {
        type: 'A',
        name: envVars.NEXT_PUBLIC_CDN_BASE_URL.replace('https://', ''),
        ttl: 1,
        proxied: true,
        content: 'YOUR_SERVER_IP',
      },
      {
        type: 'AAAA',
        name: envVars.NEXT_PUBLIC_CDN_BASE_URL.replace('https://', ''),
        ttl: 1,
        proxied: true,
        content: 'YOUR_SERVER_IPV6',
      },
    ],
  };

  // Save DNS configuration
  const dnsPath = path.join(process.cwd(), 'dns-config.json');
  fs.writeFileSync(dnsPath, JSON.stringify(dnsConfig, null, 2));
  console.log(chalk.green('✅ DNS configuration created'));

  console.log(chalk.blue('\n🔧 Cloudflare setup complete!'));
  console.log(chalk.yellow('\nNext steps:'));
  console.log(chalk.yellow('1. Run: cloudflare login'));
  console.log(chalk.yellow('2. Update dns-config.json with your server IP'));
  console.log(chalk.yellow('3. Run: cloudflare dns import dns-config.json'));
  console.log(chalk.yellow('4. Deploy your application'));
}

function setupAWSCDN(envVars) {
  console.log(chalk.blue('\n🌉 Setting up AWS CloudFront CDN...'));

  // Create CloudFront configuration
  const cloudfrontConfig = {
    comment: 'MixHive CDN Distribution',
    enabled: true,
    priceClass: 'PriceClass_100',
    defaultRootObject: 'index.html',
    origins: [
      {
        id: 'MixHiveOrigin',
        domainName: envVars.NEXT_PUBLIC_CDN_BASE_URL.replace('https://', ''),
        customOriginConfig: {
          HTTPPort: 80,
          HTTPSPort: 443,
          OriginProtocolPolicy: 'https-only',
          OriginReadTimeout: 30,
          OriginKeepaliveTimeout: 5,
        },
      },
    ],
    defaultCacheBehavior: {
      targetOriginId: 'MixHiveOrigin',
      viewerProtocolPolicy: 'redirect-to-https',
      allowedMethods: ['GET', 'HEAD', 'OPTIONS'],
      cachedMethods: ['GET', 'HEAD'],
      compress: true,
      cachePolicyId: '4135ea2d-6df8-44bf-88e8-bb5bbbe87bd4', // CachingOptimized
      originRequestPolicyId: 'b689b0a8-53d0-40ab-baf3-687b2966ac16', // Viewer
      responseHeadersPolicyId: 'e0d1b042-8f5d-419a-8cfe-06b8a8c6a8a1', // SecurityHeadersPolicy
    },
    orderedCacheBehaviors: [
      {
        pathPattern: '/images/*',
        targetOriginId: 'MixHiveOrigin',
        viewerProtocolPolicy: 'redirect-to-https',
        allowedMethods: ['GET', 'HEAD', 'OPTIONS'],
        cachedMethods: ['GET', 'HEAD'],
        compress: true,
        cachePolicyId: '4135ea2d-6df8-44bf-88e8-bb5bbbe87bd4',
        originRequestPolicyId: 'b689b0a8-53d0-40ab-baf3-687b2966ac16',
        responseHeadersPolicyId: 'e0d1b042-8f5d-419a-8cfe-06b8a8c6a8a1',
      },
      {
        pathPattern: '/audio/*',
        targetOriginId: 'MixHiveOrigin',
        viewerProtocolPolicy: 'redirect-to-https',
        allowedMethods: ['GET', 'HEAD', 'OPTIONS'],
        cachedMethods: ['GET', 'HEAD'],
        compress: true,
        cachePolicyId: '4135ea2d-6df8-44bf-88e8-bb5bbbe87bd4',
        originRequestPolicyId: 'b689b0a8-53d0-40ab-baf3-687b2966ac16',
        responseHeadersPolicyId: 'e0d1b042-8f5d-419a-8cfe-06b8a8c6a8a1',
      },
    ],
    restrictions: {
      geoRestriction: {
        restrictionType: 'none',
      },
    },
    viewerCertificate: {
      cloudFrontDefaultCertificate: true,
    },
    webACLId: 'YOUR_WEB_ACL_ID',
    httpVersion: 'http2',
    isIPV6Enabled: true,
  };

  // Save CloudFront configuration
  const configPath = path.join(process.cwd(), 'cloudfront-config.json');
  fs.writeFileSync(configPath, JSON.stringify(cloudfrontConfig, null, 2));
  console.log(chalk.green('✅ CloudFront configuration created'));

  // Create CloudFormation template
  const cloudFormationTemplate = {
    AWSTemplateFormatVersion: '2010-09-09',
    Description: 'MixHive CloudFront CDN',
    Resources: {
      CloudFrontDistribution: {
        Type: 'AWS::CloudFront::Distribution',
        Properties: {
          DistributionConfig: cloudfrontConfig,
        },
      },
    },
  };

  // Save CloudFormation template
  const cfnPath = path.join(process.cwd(), 'cdn-cfn-template.json');
  fs.writeFileSync(cfnPath, JSON.stringify(cloudFormationTemplate, null, 2));
  console.log(chalk.green('✅ CloudFormation template created'));

  console.log(chalk.blue('\n🔧 AWS CloudFront setup complete!'));
  console.log(chalk.yellow('\nNext steps:'));
  console.log(chalk.yellow('1. Update cloudfront-config.json with your origin domain'));
  console.log(chalk.yellow('2. Deploy using AWS CLI or CloudFormation'));
  console.log(chalk.yellow('3. Set up AWS credentials'));
  console.log(chalk.yellow('4. Deploy your application'));
}

function setupCustomCDN(envVars) {
  console.log(chalk.blue('\n🏗️ Setting up custom CDN...'));

  // Create custom CDN configuration
  const customCDNConfig = {
    provider: 'custom',
    domains: [envVars.NEXT_PUBLIC_CDN_BASE_URL.replace('https://', '')],
    buckets: {
      images: {
        path: '/images',
        cache: {
          ttl: '7d',
          compression: true,
        },
        headers: {
          'Cache-Control': 'public, max-age=604800, immutable',
          'Content-Type': 'image/jpeg',
        },
      },
      audio: {
        path: '/audio',
        cache: {
          ttl: '30d',
          compression: false,
        },
        headers: {
          'Cache-Control': 'public, max-age=2592000, immutable',
        },
      },
      artwork: {
        path: '/artwork',
        cache: {
          ttl: '7d',
          compression: true,
        },
        headers: {
          'Cache-Control': 'public, max-age=604800, immutable',
        },
      },
    },
    security: {
      enabled: true,
      headers: {
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      },
    },
    performance: {
      enableCompression: true,
      enableBrotli: true,
      enableGzip: true,
      cacheImages: true,
      cacheAudio: true,
    },
  };

  // Save custom CDN configuration
  const configPath = path.join(process.cwd(), 'custom-cdn-config.json');
  fs.writeFileSync(configPath, JSON.stringify(customCDNConfig, null, 2));
  console.log(chalk.green('✅ Custom CDN configuration created'));

  // Create Nginx configuration template
  const nginxConfig = `
# MixHive Custom CDN Configuration
# Generated on ${new Date().toISOString()}

server {
    listen 80;
    listen [::]:80;
    server_name ${envVars.NEXT_PUBLIC_CDN_BASE_URL.replace('https://', '')};
    
    # Redirect to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${envVars.NEXT_PUBLIC_CDN_BASE_URL.replace('https://', '')};
    
    # SSL Configuration
    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    
    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # Static Assets
    location /images/ {
        proxy_pass http://your-backend:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Cache static assets
        expires 7d;
        add_header Cache-Control "public, max-age=604800, immutable";
        
        # Compression
        gzip on;
        gzip_types image/jpeg image/png image/webp;
    }
    
    location /audio/ {
        proxy_pass http://your-backend:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Cache audio files
        expires 30d;
        add_header Cache-Control "public, max-age=2592000, immutable";
        
        # No compression for audio
        gzip off;
    }
    
    location /artwork/ {
        proxy_pass http://your-backend:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Cache artwork
        expires 7d;
        add_header Cache-Control "public, max-age=604800, immutable";
        
        # Compression
        gzip on;
        gzip_types image/jpeg image/png image/webp;
    }
    
    # API endpoints
    location /api/ {
        proxy_pass http://your-backend:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # No caching for API
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
    
    # Default
    location / {
        proxy_pass http://your-backend:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
`;

  // Save Nginx configuration
  const nginxPath = path.join(process.cwd(), 'nginx-cdn.conf');
  fs.writeFileSync(nginxPath, nginxConfig);
  console.log(chalk.green('✅ Nginx configuration created'));

  // Create Docker configuration
  const dockerConfig = `
# MixHive Custom CDN Docker Configuration
version: '3.8'

services:
  nginx-cdn:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx-cdn.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
      - ./custom-cdn-config.json:/etc/nginx/custom-cdn.json
    environment:
      - CDN_DOMAIN=${envVars.NEXT_PUBLIC_CDN_BASE_URL.replace('https://', '')}
      - BACKEND_URL=http://your-backend:3000
    restart: unless-stopped
    
  # Optional: Add monitoring
  prometheus:
    image: prom/prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    restart: unless-stopped
`;

  // Save Docker configuration
  const dockerPath = path.join(process.cwd(), 'docker-cdn.yml');
  fs.writeFileSync(dockerPath, dockerConfig);
  console.log(chalk.green('✅ Docker configuration created'));

  console.log(chalk.blue('\n🔧 Custom CDN setup complete!'));
  console.log(chalk.yellow('\nNext steps:'));
  console.log(chalk.yellow('1. Update nginx-cdn.conf with your backend URL'));
  console.log(chalk.yellow('2. Add SSL certificates to ssl/ directory'));
  console.log(chalk.yellow('3. Run: docker-compose -f docker-cdn.yml up -d'));
  console.log(chalk.yellow('4. Deploy your application'));
}

console.log(chalk.green('\n🎉 CDN setup complete!'));
console.log(chalk.blue('\n📋 Configuration files created:'));
console.log(chalk.yellow('• Cloudflare: cloudflare.json, cloudflare-rules.json, dns-config.json'));
console.log(chalk.yellow('• AWS CloudFront: cloudfront-config.json, cdn-cfn-template.json'));
console.log(chalk.yellow('• Custom: custom-cdn-config.json, nginx-cdn.conf, docker-cdn.yml'));

console.log(chalk.blue('\n🚀 Next steps:'));
console.log(chalk.yellow('1. Choose your CDN provider and follow the specific instructions'));
console.log(chalk.yellow('2. Configure DNS settings'));
console.log(chalk.yellow('3. Test CDN functionality'));
console.log(chalk.yellow('4. Deploy your application with CDN enabled'));
