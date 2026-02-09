# How to Verify Your Supabase Keys

## Step 1: Find Your Correct Supabase Keys

1. Go to https://supabase.com/dashboard
2. Sign in to your account
3. Select your project (or create one if you don't have one)
4. Go to **Settings** (gear icon in the left sidebar)
5. Click on **API** in the settings menu

You'll see:
- **Project URL** - This is your `NEXT_PUBLIC_SUPABASE_URL`
- **anon/public key** - This is your `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role key** - This is your `SUPABASE_SERVICE_ROLE_KEY` (keep this secret!)

## Step 2: Verify Your .env.local File

Your `.env.local` file should have:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Important:**
- The URL should start with `https://` and end with `.supabase.co`
- The anon key should be a long JWT token starting with `eyJ...`
- Make sure there are NO quotes around the values
- Make sure there are NO spaces before or after the `=` sign

## Step 3: Check Allowed Origins (CORS Settings)

1. In Supabase Dashboard, go to **Settings** → **API**
2. Scroll down to find **CORS Settings** or **Allowed Origins**
3. Make sure these URLs are in the list:
   - `http://localhost:3000` (for local development)
   - `http://localhost:3001` (if you use a different port)
   - Your production URL (when you deploy)

If the list is empty or doesn't include localhost, add it:
- Click "Add URL" or edit the list
- Add: `http://localhost:3000`
- Save

## Step 4: Verify Your Keys Are Correct

After updating your `.env.local`:

1. **Restart your dev server** (this is crucial!)
   ```bash
   # Stop the server (Ctrl+C)
   npm run dev
   ```

2. Check the browser console when you try to sign up
   - Open Developer Tools (F12)
   - Go to Console tab
   - Look for any errors mentioning Supabase

3. Test the connection:
   - Try signing up again
   - Check if you get a different error message
   - The error should be more specific now

## Common Issues:

### Issue 1: Wrong Project URL
- **Symptom**: "Failed to fetch" or network errors
- **Fix**: Make sure the URL in `.env.local` matches exactly what's in Supabase Dashboard → Settings → API → Project URL

### Issue 2: Wrong Anon Key
- **Symptom**: "Invalid API key" or authentication errors
- **Fix**: Copy the "anon/public" key from Supabase Dashboard → Settings → API (NOT the service_role key)

### Issue 3: Missing CORS Configuration
- **Symptom**: CORS errors in browser console
- **Fix**: Add `http://localhost:3000` to allowed origins in Supabase Dashboard → Settings → API

### Issue 4: Environment Variables Not Loaded
- **Symptom**: "Missing NEXT_PUBLIC_SUPABASE_URL" error
- **Fix**: 
  - Make sure file is named `.env.local` (not `.env` or `.env.example`)
  - Restart your dev server after changing `.env.local`
  - Make sure variables start with `NEXT_PUBLIC_` for client-side access

## Quick Test:

After updating your keys, you can test if they work by running this in your browser console (on your app page):

```javascript
fetch('YOUR_SUPABASE_URL/rest/v1/', {
  headers: {
    'apikey': 'YOUR_ANON_KEY',
    'Authorization': 'Bearer YOUR_ANON_KEY'
  }
})
.then(r => r.json())
.then(console.log)
.catch(console.error)
```

If this works, your keys are correct!
