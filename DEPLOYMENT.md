# MixHive Deployment Guide

## 🚀 Getting Started

MixHive is a comprehensive DJ social media platform that can be deployed to multiple platforms. This guide covers deployment options including Vercel, Docker, and cloud providers.

## 📋 Prerequisites

### Environment Variables

Before deployment, ensure these environment variables are set in your `.env` file:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Analytics & Monitoring
NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn
NEXT_PUBLIC_VERCEL_ANALYTICS_ID=your_vercel_analytics_id
NEXT_PUBLIC_VERCEL_SPEED_INSIGHTS_ID=your_speed_insights_id

# Authentication
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=http://localhost:3000

# Database
DATABASE_URL=your_database_url
REDIS_URL=your_redis_url

# CDN Configuration
CDN_PROVIDER=cloudflare  # or 'aws' or 'custom'
CUSTOM_CDN_URL=https://your-cdn-domain.com

# Optional: Custom domain
NEXT_PUBLIC_CUSTOM_DOMAIN=your-custom-domain.com
```

### Required Tools

- **Node.js** (v18+)
- **npm** or **yarn**
- **Git**
- **Vercel CLI** (for Vercel deployment): `npm install -g vercel`
- **Docker** (for Docker deployment)

## 🏗️ Deployment Options

### 1. Vercel Deployment (Recommended)

#### Quick Deployment

```bash
# Install dependencies
npm install

# Run deployment script
npm run deploy

# Or deploy manually
vercel --prod
```

#### Automated Deployment

1. **Connect GitHub Repository**
   ```bash
   vercel
   ```
   - Select your GitHub repository
   - Configure environment variables
   - Enable auto-deployment on push

2. **Environment Setup**
   ```bash
   # Set Vercel environment variables
   vercel env add NEXT_PUBLIC_SUPABASE_URL
   vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
   vercel env add SUPABASE_SERVICE_ROLE_KEY
   # Add all required environment variables...
   ```

#### Vercel Configuration

Create `vercel.json`:

```json
{
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/next"
    }
  ],
  "env": {
    "NEXT_PUBLIC_SUPABASE_URL": "@supabase_url",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": "@supabase_anon_key",
    "SUPABASE_SERVICE_ROLE_KEY": "@supabase_service_role_key"
  },
  "functions": {
    "src/app/api/**": {
      "maxDuration": 30
    }
  },
  "crons": [
    {
      "path": "/api/cleanup",
      "schedule": "0 0 * * *"
    }
  ]
}
```

### 2. Docker Deployment

#### Build and Run

```bash
# Build Docker image
docker build -t mixhive .

# Run container
docker run -p 3000:3000 --env-file .env.production mixhive

# Or with Docker Compose
docker-compose up -d
```

#### Docker Compose Configuration

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: mixhive
      POSTGRES_USER: mixhive
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

### 3. Cloud Provider Deployment

#### AWS Deployment

1. **Elastic Beanstalk**
   ```bash
   eb init mixhive
   eb create production
   eb deploy
   ```

2. **ECS**
   ```bash
   # Create task definition
   aws ecs register-task-definition --cli-input-json file://task-definition.json
   ```

3. **S3 + CloudFront**
   - Build: `npm run build`
   - Upload: `aws s3 sync .next s3://your-bucket --delete`
   - Invalidate: `aws cloudfront create-invalidation`

#### Google Cloud Platform

1. **Cloud Run**
   ```bash
   gcloud builds submit --tag gcr.io/your-project/mixhive
   gcloud run deploy mixhive --image gcr.io/your-project/mixhive
   ```

2. **App Engine**
   ```bash
   gcloud app deploy
   ```

#### Azure

1. **App Service**
   ```bash
   az webapp up --name mixhive --resource-group your-resource-group
   ```

2. **Container Instances**
   ```bash
   az container create --name mixhive --image your-image
   ```

## 🔧 Configuration

### Database Setup

1. **Create Supabase Project**
   ```bash
   # Initialize Supabase local development
   supabase init
   supabase start
   ```

2. **Run Migrations**
   ```bash
   supabase db push
   ```

3. **Set Up Storage Buckets**
   ```bash
   # Create storage buckets
   supabase storage create avatars
   supabase storage create banners
   supabase storage create mixes
   supabase storage create artwork
   ```

### CDN Configuration

Choose your CDN provider:

```bash
# Cloudflare (Recommended)
CDN_PROVIDER=cloudflare

# AWS CloudFront
CDN_PROVIDER=aws

# Custom CDN
CDN_PROVIDER=custom
CUSTOM_CDN_URL=https://your-cdn-domain.com
```

### Analytics Setup

1. **Google Analytics**
   ```bash
   # Add tracking ID to .env
   NEXT_PUBLIC_GA_ID=your-ga-id
   ```

2. **Mixpanel**
   ```bash
   # Add Mixpanel token
   NEXT_PUBLIC_MIXPANEL_TOKEN=your-mixpanel-token
   ```

3. **Sentry**
   ```bash
   # Add Sentry DSN
   NEXT_PUBLIC_SENTRY_DSN=your-sentry-dsn
   ```

## 🧪 Testing

### Run Test Suite

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run CI tests
npm run test:ci
```

### Deployment Verification

```bash
# Run deployment verification
npm run deploy:verify

# Or run manually
node scripts/deploy-verify.js
```

## 📊 Monitoring & Analytics

### Application Monitoring

- **Sentry**: Error tracking and performance monitoring
- **Vercel Analytics**: Real-time application analytics
- **Google Analytics**: User behavior and traffic analysis
- **Mixpanel**: Advanced user analytics and funnels

### Infrastructure Monitoring

- **Cloudflare Analytics**: CDN performance and traffic
- **AWS CloudWatch**: Infrastructure metrics
- **Vercel Speed Insights**: Performance optimization

### Custom Analytics

The application includes built-in analytics tracking:

```typescript
// Track user interactions
analyticsTracker.trackUserInteraction('mix', 'play', mixId)

// Track page views
analyticsTracker.trackPageView('/mixes/' + mixId)

// Track search queries
analyticsTracker.trackSearch('techno', 25, 'mixes')
```

## 🔒 Security

### Environment Security

- Use environment variables for sensitive data
- Never commit secrets to version control
- Use secure, random secrets

### CORS Configuration

```javascript
// next.config.mjs
const nextConfig = {
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.CORS_ORIGIN || '*',
          },
        ],
      },
    ]
  },
}
```

### Rate Limiting

```javascript
// middleware.ts
export async function middleware(request: NextRequest) {
  const rateLimit = new RateLimit({
    interval: 60 * 1000, // 1 minute
    uniqueTokenPerRequest: true,
  })

  try {
    await rateLimit.check(request.ip ?? '127.0.0.1')
    return NextResponse.next()
  } catch {
    return new Response('Too Many Requests', { status: 429 })
  }
}
```

## 🚀 Deployment Scripts

### Automated Deployment

```bash
# Full deployment process
npm run deploy

# Deploy to Vercel
npm run deploy:vercel

# Deploy to Docker
npm run deploy:docker

# Run verification
npm run deploy:verify
```

### Custom Deployment Scripts

Create custom deployment scripts in `scripts/`:

```javascript
// scripts/custom-deploy.js
const { execSync } = require('child_process')

// Custom deployment logic
execSync('npm ci', { stdio: 'inherit' })
execSync('npm run build', { stdio: 'inherit' })
// Add your deployment steps...
```

## 📈 Performance Optimization

### Build Optimization

```bash
# Analyze build size
npm run analyze

# Optimize images
npm run optimize:images

# Optimize bundles
npm run optimize:bundle
```

### CDN Optimization

- Enable image optimization
- Use modern image formats (WebP, AVIF)
- Implement lazy loading
- Cache static assets

### Database Optimization

- Use database indexes
- Implement connection pooling
- Optimize queries
- Use read replicas for scaling

## 🚨 Troubleshooting

### Common Issues

1. **Build Failures**
   ```bash
   # Check TypeScript errors
   npm run type-check
   
   # Check linting
   npm run lint
   ```

2. **Environment Variables**
   ```bash
   # Verify environment variables
   node -e "console.log(process.env.NEXT_PUBLIC_SUPABASE_URL)"
   ```

3. **Database Connection**
   ```bash
   # Test database connection
   npm run db:test
   ```

### Debug Mode

```bash
# Enable debug mode
npm run debug:start

# View logs
npm run debug:logs
```

## 🔄 CI/CD Pipeline

### GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Vercel

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:ci
      - run: npm run build
      - run: npm run deploy:vercel
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
```

### GitLab CI

Create `.gitlab-ci.yml`:

```yaml
image: node:18

stages:
  - test
  - build
  - deploy

test:
  stage: test
  script:
    - npm ci
    - npm run test:ci

build:
  stage: build
  script:
    - npm ci
    - npm run build

deploy:
  stage: deploy
  script:
    - npm run deploy:vercel
  only:
    - main
```

## 📚 Additional Resources

### Documentation

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Vercel Documentation](https://vercel.com/docs)
- [Docker Documentation](https://docs.docker.com)

### Community Support

- GitHub Issues: [MixHive Issues](https://github.com/your-repo/issues)
- Discord: [MixHive Community](https://discord.gg/mixhive)
- Stack Overflow: [MixHive Questions](https://stackoverflow.com/questions/tagged/mixhive)

### Professional Support

- Enterprise support options available
- Custom development services
- Performance optimization consulting

---

## 🎉 Conclusion

MixHive is now ready for deployment! Choose your preferred deployment method and follow the steps above. For any issues or questions, refer to the troubleshooting section or reach out to the community.

Happy mixing! 🎵

---

## 📦 Production Deployment Record — 2026-05-29 (Mythic Co-Production Sessions v1)

**Feature**: Full realtime Mythic Co-Production Sessions vertical (Experiment 1)  
**Scope**: All 5 polish items + every open question/task from the approved plan  
**URL**: https://vercel.mixhive.app (and custom domains)

### Changes in This Deployment
- Real-username presence + live typing indicators in collab rooms
- Stem tracking during sessions → automatic `inspired_by` + `collab_with` graph edges via job
- Production-grade Post-Session Review + one-click approval that writes permanent provenance to `mythic_edges.metadata`
- Primary entry point on Profile pages (own profile)
- Secondary entry point pattern on Mix detail pages
- Removed all dev scaffolding (`SessionFab`, `confirm()` dialogs, inconsistent error handling)
- Shared API error utilities applied consistently

### Verification Performed
- `npx tsc --noEmit` — clean
- `npm run build` — succeeded
- Full 2-tab manual flow (real names, typing, stems → job → review → approve → graph mutation) exercised in dev against migrations 048-050

### Documentation Delivered
- `docs/EXPERIMENT1_MYTHIC_CO_PRODUCTION_SESSIONS_DEPLOYED.md` (canonical reference)
- Updated `docs/TESTING_MANUAL_EXPERIMENTS.md`
- Detailed deployment + test notes in this file
- Plan file (`.grok/sessions/.../019e7372.../plan.md`) marked **DEPLOYED — ALL QUESTIONS ALL TASKS COMPLETE**

### How to Test Immediately After This Deploy
See the exact step-by-step in `docs/EXPERIMENT1_MYTHIC_CO_PRODUCTION_SESSIONS_DEPLOYED.md` → "How to Test on Production".

Quick version:
1. Log into vercel.mixhive.app as an artist
2. Go to your Profile → "+ Start Mythic Session"
3. Open second tab with another artist
4. Experience real names + live typing
5. Add stems → End → Review → Approve
6. Query `mythic_edges` — the edges now have `metadata.status = 'approved'` + full provenance

### Rollback
Revert the small set of files touched in the 2026-05-29 tranche commit. No schema changes were introduced in this deployment.

**This marks the first major public-facing MythicNode-powered realtime collaboration surface live on production.**

Next recommended work (out of scope for this deploy):
- Message history table (migration 051)
- Lua agent surfaces for sessions
- Richer invitation + participant discovery UI
- Automated Playwright tests for the vertical
- Cross-experiment wiring (approved collab edges feeding Yield / Quests)