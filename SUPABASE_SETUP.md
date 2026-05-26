# Supabase Authentication Setup Guide

## 🚨 **Issue Resolved**
The DNS resolution issue has been identified and a placeholder URL has been set up in your configuration.

## ✅ **Completed Steps**
1. ✅ Updated `.env.local` with placeholder URL
2. ✅ Committed changes to GitHub
3. ✅ Development server is running on `localhost:5173`

## 🔧 **Next Steps Required**

### **Step 1: Create Supabase Project**
1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Click "New Project"
3. Fill in project details:
   - **Name**: `mixhive-production` (or your preferred name)
   - **Database Password**: Choose a strong password
   - **Region**: Choose a region close to your users
4. Wait for project creation to complete

### **Step 2: Get Production URL**
Once your project is created, copy the project URL from the dashboard:
- Format: `https://project-id.supabase.co`
- Example: `https://wlfjbzdzmrqiiguyoulj.supabase.co` (this is your OAuth project ID)

### **Step 3: Update Environment File**
Replace the placeholder in `.env.local`:

```bash
# Before:
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co

# After (with your actual project URL):
VITE_SUPABASE_URL=https://your-actual-project-id.supabase.co
```

### **Step 4: Configure Google OAuth**
1. In your Supabase dashboard, go to: **Settings > Authentication > Providers**
2. Enable **Google** provider
3. Use these credentials (from `/secrets/google-oauth.json`, which is gitignored):
   - **Client ID**: `<your-client-id>.apps.googleusercontent.com`
   - **Client Secret**: `<your-client-secret>`
4. Set **Redirect URI**: `https://your-project-id.supabase.co/auth/v1/callback`

### **Step 5: Apply Database Migrations**
1. In Supabase dashboard, go to: **SQL Editor**
2. Run all migrations from `/supabase/migrations/` folder

### **Step 6: Commit Final Configuration**
After updating the URL, commit the changes:
```bash
git add .env.local
git commit -m "feat: Configure production Supabase project"
git push origin main
```

## 📝 **Google OAuth Configuration Details**

### **Credentials File Location**
- **File**: `/secrets/google-oauth.json` (gitignored — never commit)
- **Client ID**: `<your-client-id>.apps.googleusercontent.com`
- **Client Secret**: `<your-client-secret>`

> ⚠️ Do NOT inline the real client ID or secret in committed markdown.
> GitHub Push Protection will block the push, and even one slip is a
> credentials-rotation event. Load values from `/secrets/google-oauth.json`
> at deploy time only.

### **Redirect URI Format**
```
https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback
```

## 🧪 **Testing Your Setup**

### **Test 1: URL Resolution**
```bash
curl -I https://your-project-id.supabase.co
# Should return HTTP 200 or similar
```

### **Test 2: Authentication**
1. Open `http://localhost:5173/`
2. Click "Sign in with Google"
3. Complete OAuth flow
4. Should redirect back to MixHive

## 🔍 **Troubleshooting**

### **DNS Issues Still Persisting?**
- Wait 5-10 minutes after project creation
- Try clearing browser DNS cache
- Use `https://` (not `http://`)

### **OAuth Not Working?**
- Verify Client ID and Secret are correct
- Check that redirect URI matches exactly
- Ensure project is in "production" mode

### **Database Issues?**
- Run all migrations in SQL Editor
- Verify database is accessible
- Check RLS policies

## 🎯 **Success Criteria**
- ✅ Production URL resolves correctly
- ✅ Google OAuth authentication works
- ✅ Users can sign in and create profiles
- ✅ All committed and pushed to GitHub

## 📞 **Need Help?**
If you encounter issues, check:
1. Supabase dashboard status
2. Project creation complete
3. All migrations applied
4. OAuth provider enabled and configured