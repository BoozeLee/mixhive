# MixHive Deployment Guide

## Prerequisites

1. **Supabase Account** - Create a project at [supabase.com](https://supabase.com)
2. **Vercel Account** - Create an account at [vercel.com](https://vercel.com)
3. **Google OAuth Credentials** - For Google authentication

## Environment Variables Setup

### Required Environment Variables

Create a `.env.local` file in the root directory:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Vercel Configuration (for production deployment)
VERCEL_URL=mixhive.vercel.app
```

### Optional Environment Variables

```bash
# Google OAuth (optional - if using Google sign-in)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Analytics and Monitoring
SENTRY_DSN=your-sentry-dsn
```

## Supabase Setup

### 1. Create New Project
1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Enter project details
4. Wait for project to initialize

### 2. Run Database Migrations
1. In the Supabase Dashboard, go to "SQL Editor"
2. Copy and paste all migration files from `supabase/migrations/`
3. Execute them in order (001-016)

### 3. Create Storage Buckets
Required buckets:
- `mix-audio` - For audio files
- `mix-artwork` - For cover art
- `mix-waveforms` - For waveform data
- `mixes-original` - For original uploads

### 4. Configure Authentication
1. Go to "Authentication" > "Providers"
2. Enable Email and Google OAuth
3. For Google OAuth, configure redirect URI:
   ```
   https://your-project-id.supabase.co/auth/v1/callback
   ```

## Vercel Deployment

### 1. Connect Repository
1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Connect your GitHub repository
4. Import the `mixhive` project

### 2. Configure Environment Variables
In the Vercel dashboard:
1. Go to "Settings" > "Environment Variables"
2. Add all required environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VERCEL_URL`

### 3. Configure Build Settings
In the Vercel dashboard:
1. Go to "Settings" > "Build & Development Settings"
2. Build Command: `npm run build`
3. Output Directory: `dist`
4. Install Command: `npm install`

### 4. Deploy
Click "Deploy" to deploy your application.

The canonical production URL is:

```text
https://mixhive.vercel.app
```

Use the unique Vercel deployment URL only for debugging individual deployments.
Do not use `mixhive.app` unless that domain has been registered and publicly
delegated; public DNS currently treats it as non-existent.

## Production Deployment Checklist

- [ ] Supabase project created and configured
- [ ] All database migrations executed
- [ ] Storage buckets created
- [ ] Authentication providers configured
- [ ] Environment variables set in Vercel
- [ ] Build successful
- [ ] Vercel domain `mixhive.vercel.app` resolves
- [ ] SSL enabled (automatic on Vercel)

## Local Development

For local development, make sure to:

1. Copy `.env.example` to `.env.local`
2. Fill in your Supabase credentials
3. Run `npm install`
4. Run `npm run dev`

## Monitoring & Analytics

The application includes:
- Vercel Analytics (built-in)
- Sentry error tracking
- Supabase logging

## Troubleshooting

### Common Issues

1. **Build Errors**: Check TypeScript compilation and JSX syntax
2. **Authentication Issues**: Verify Supabase environment variables
3. **Storage Issues**: Ensure buckets exist and have proper permissions
4. **CORS Issues**: Verify Supabase CORS settings

### Debug Commands

```bash
# Check for TypeScript errors
npm run build

# Run linter
npm run lint

# Check database types
npm run db:types:check
```

## Performance Optimization

The application includes several performance optimizations:
- Code splitting with React.lazy
- Optimized bundle sizes
- Image optimization
- CDN caching via Vercel
- Real-time subscriptions

## Security Features

- Content Security Policy headers
- RLS (Row Level Security) in Supabase
- Input validation with Zod
- XSS protection
- CSRF protection

## Maintenance

### Regular Tasks
- Monitor error rates via Sentry
- Update dependencies regularly
- Review Supabase usage logs
- Monitor storage quotas

### Database Maintenance
- Run schema drift checks periodically
- Monitor query performance
- Archive old mixes if needed

## Support

For issues:
- Check the GitHub issues
- Review the Supabase logs
- Monitor Vercel build logs
- Check browser console for errors

---

This deployment guide covers everything needed to get MixHive running in production. The application is production-ready with proper error handling, monitoring, and security measures in place.
