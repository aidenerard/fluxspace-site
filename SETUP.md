# FluxSpace - Quick Setup Guide

## Initial Setup

1. **Install Dependencies**
```bash
npm install
```

2. **Environment Variables**
Copy `.env.example` to `.env.local` and fill in your credentials:

```bash
cp .env.example .env.local
```

Required variables:
- Supabase URL and keys (from supabase.com)
- Stripe keys and price IDs (from stripe.com)
- App URL (http://localhost:3000 for development)

## Database Setup

Run this SQL in your Supabase SQL editor:

```sql
-- Create users table
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create projects table
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create uploads table
CREATE TABLE IF NOT EXISTS public.uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  storage_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create jobs table
CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  upload_id UUID NOT NULL REFERENCES public.uploads(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'done', 'failed')),
  params JSONB,
  result_tif_url TEXT,
  result_png_url TEXT,
  result_csv_url TEXT,
  logs TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create usage counters table
CREATE TABLE IF NOT EXISTS public.usage_counters (
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  jobs_used INTEGER DEFAULT 0,
  storage_used_bytes BIGINT DEFAULT 0,
  PRIMARY KEY (user_id, month)
);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own data" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own data" ON public.users FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own projects" ON public.projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own projects" ON public.projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON public.projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects" ON public.projects FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own uploads" ON public.uploads FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.projects WHERE projects.id = uploads.project_id AND projects.user_id = auth.uid())
);

CREATE POLICY "Users can view own jobs" ON public.jobs FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.projects WHERE projects.id = jobs.project_id AND projects.user_id = auth.uid())
);

CREATE POLICY "Users can view own usage" ON public.usage_counters FOR SELECT USING (auth.uid() = user_id);
```

## Create Storage Buckets

In Supabase Storage, create two buckets:
1. `uploads` (private)
2. `results` (private)

Add storage policies in Supabase Dashboard.

## Stripe Setup

1. Create products in Stripe Dashboard:
   - Starter ($0/month or free)
   - Pro ($29/month)
   - Team ($99/month)

2. Copy price IDs to `.env.local`

3. Set up webhook endpoint: `https://your-domain.com/api/stripe/webhook`

## Run Development Server

```bash
npm run dev
```

Visit http://localhost:3000

## Seed Demo Data

```bash
npm run seed
```

This creates:
- Demo user: demo@fluxspace.com (password: demo123)
- Sample project with completed job

## Deployment

### Vercel

1. Push to GitHub
2. Import in Vercel
3. Add environment variables
4. Deploy

### Post-Deployment

- Update Stripe webhook to production URL
- Update `NEXT_PUBLIC_APP_URL`
- Configure Supabase auth redirect URLs

## Project Structure

```
fluxspace/
├── app/                 # Next.js pages
│   ├── page.tsx        # Home page
│   ├── dashboard/      # Dashboard
│   ├── signin/         # Authentication
│   ├── api/            # API routes
│   └── ...
├── components/         # React components
│   ├── ui/            # shadcn/ui components
│   ├── navbar.tsx     # Navigation
│   └── ...
├── lib/               # Utilities
│   ├── supabase.ts   # Database client
│   ├── stripe.ts     # Payment client
│   └── utils.ts      # Helpers
└── scripts/          # Utility scripts
```

## Key Features Implemented

✅ Authentication (Supabase)
✅ Dashboard with project management
✅ Responsive design with dark mode
✅ Stripe integration ready
✅ Database schema with RLS
✅ CSV schema documentation
✅ Pricing page
✅ Product page
✅ Documentation
✅ API routes for projects and jobs

## Next Steps

To complete the application:

1. **Processing Pipeline**: Implement the actual magnetic data processing (frame rotation, gridding, etc.)
2. **Map Viewer**: Add MapLibre GL viewer with heatmap overlays
3. **File Upload**: Implement direct-to-storage uploads with presigned URLs
4. **Stripe Webhooks**: Handle subscription events
5. **Email Notifications**: Job completion alerts
6. **Usage Enforcement**: Check plan limits before job creation
7. **Tests**: Add unit and integration tests

## Support

For issues or questions, refer to:
- README.md for detailed documentation
- /docs page for user documentation
- Supabase docs: https://supabase.com/docs
- Next.js docs: https://nextjs.org/docs
