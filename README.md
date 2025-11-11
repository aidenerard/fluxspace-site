# FluxSpace

**Autonomous magnetic mapping for hidden structural issues.**

FluxSpace is a production-ready SaaS platform that processes drone magnetometer data to produce 2D/3D magnetic anomaly maps for structural assessment. Upload CSV flight logs and get georeferenced heatmaps in minutes.

## Features

- 🚁 **Drone Data Processing** - Upload magnetometer CSV logs (time, lat/lon, alt, attitude, Bx/By/Bz)
- 🗺️ **Interactive Map Viewer** - MapLibre GL with heatmap overlays, color ramps, and opacity controls
- 📊 **Dual-Sensor Support** - Automatic gradiometer ΔB calculation for enhanced anomaly detection
- 🎯 **High Resolution** - 10-25cm pixel resolution with automatic UTM projection
- 📦 **Export Options** - Download GeoTIFF, PNG previews, and CSV gridded data
- 💳 **Stripe Integration** - Subscription billing with usage metering
- 🔐 **Secure Auth** - Supabase authentication with row-level security
- 🌓 **Dark Mode** - Full dark mode support with magnetic heatmap color scheme

## Tech Stack

- **Framework**: Next.js 14 (App Router) + TypeScript
- **Styling**: TailwindCSS + shadcn/ui components
- **Auth & Database**: Supabase (Postgres + Storage)
- **Payments**: Stripe (Checkout + Customer Portal)
- **Maps**: MapLibre GL + deck.gl
- **Charts**: Recharts
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- Supabase account and project
- Stripe account (test mode for development)

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd fluxspace
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_STARTER_PRICE_ID=price_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_TEAM_PRICE_ID=price_...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Database Setup

Run the following SQL in your Supabase SQL editor to create the required tables:

```sql
-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Projects table
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Uploads table
CREATE TABLE IF NOT EXISTS public.uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  storage_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Jobs table
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

-- Usage counters table
CREATE TABLE IF NOT EXISTS public.usage_counters (
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  month TEXT NOT NULL, -- Format: YYYY-MM
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

-- RLS Policies
CREATE POLICY "Users can view own data" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own data" ON public.users FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own projects" ON public.projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own projects" ON public.projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON public.projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects" ON public.projects FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own uploads" ON public.uploads FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.projects WHERE projects.id = uploads.project_id AND projects.user_id = auth.uid())
);
CREATE POLICY "Users can create uploads" ON public.uploads FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.projects WHERE projects.id = uploads.project_id AND projects.user_id = auth.uid())
);

CREATE POLICY "Users can view own jobs" ON public.jobs FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.projects WHERE projects.id = jobs.project_id AND projects.user_id = auth.uid())
);
CREATE POLICY "Users can create jobs" ON public.jobs FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.projects WHERE projects.id = jobs.project_id AND projects.user_id = auth.uid())
);

CREATE POLICY "Users can view own usage" ON public.usage_counters FOR SELECT USING (auth.uid() = user_id);

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('uploads', 'uploads', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('results', 'results', false);

-- Storage policies
CREATE POLICY "Users can upload files" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'uploads' AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "Users can view own files" ON storage.objects FOR SELECT USING (
  bucket_id IN ('uploads', 'results') AND auth.uid()::text = (storage.foldername(name))[1]
);
```

### Stripe Setup

1. Create products and prices in Stripe Dashboard:
   - Starter: $0/month (or free tier)
   - Pro: $29/month
   - Team: $99/month

2. Copy the price IDs to your `.env.local`

3. Set up webhook endpoint pointing to `https://your-domain.com/api/stripe/webhook`

4. Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Seed Demo Data

Create a demo user and sample project:

```bash
npm run seed
```

This creates:
- Demo user: `demo@fluxspace.com` (password: `demo123`)
- Sample project with a processed job
- Sample result files

## Project Structure

```
fluxspace/
├── app/                      # Next.js app directory
│   ├── (auth)/              # Auth-related pages (signin, signup)
│   ├── dashboard/           # Dashboard pages
│   ├── viewer/              # Map viewer
│   ├── docs/                # Documentation pages
│   ├── api/                 # API routes
│   │   ├── projects/        # Project CRUD
│   │   ├── uploads/         # File upload handlers
│   │   ├── jobs/            # Job processing
│   │   ├── stripe/          # Stripe webhooks
│   │   └── account/         # Account management
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Home page
├── components/              # React components
│   ├── ui/                  # shadcn/ui components
│   ├── navbar.tsx           # Navigation bar
│   ├── footer.tsx           # Footer
│   └── ...
├── lib/                     # Utility libraries
│   ├── supabase.ts          # Supabase client
│   ├── stripe.ts            # Stripe client
│   └── utils.ts             # Helper functions
├── scripts/                 # Utility scripts
│   └── seed.ts              # Database seeding
└── public/                  # Static assets
```

## Key Features Implementation

### File Upload

Files are uploaded directly to Supabase Storage with presigned URLs:

1. Client requests signed URL from `/api/uploads/sign`
2. Client uploads file directly to storage
3. Server creates upload record in database

### Processing Pipeline

The processing pipeline (`/api/jobs` route) performs:

1. **CSV Parsing** - Validate columns and extract magnetometer data
2. **Frame Rotation** - Convert body-frame B vectors to earth frame using quaternions
3. **Magnetic Field Calculation** - Compute total |B| or gradiometer ΔB
4. **Filtering** - Low-pass filter and baseline removal
5. **Gridding** - Project to UTM, interpolate using IDW/griddata at 10-25cm resolution
6. **Export** - Generate GeoTIFF (with CRS), PNG preview, and CSV

### Map Viewer

Interactive viewer built with MapLibre GL featuring:

- Basemap selection
- Orthomosaic overlay (optional)
- Magnetic anomaly heatmap with customizable color ramps (Viridis, Inferno, etc.)
- Opacity controls
- Legend showing ΔB in nanoTeslas
- Download buttons for all result formats

### Billing & Usage

- Stripe Checkout for subscriptions
- Usage metering (jobs/month, storage)
- Customer portal for managing subscriptions
- Plan limit enforcement with friendly upgrade prompts

## CSV Schema

Required columns for flight log CSV:

```
time       - Unix timestamp (seconds)
lat        - Latitude (WGS84 decimal degrees)
lon        - Longitude (WGS84 decimal degrees)
alt        - Altitude (meters)
roll       - Roll angle (degrees)
pitch      - Pitch angle (degrees)
yaw        - Yaw angle (degrees)
Bx         - Magnetic field X component (nT, body frame)
By         - Magnetic field Y component (nT, body frame)
Bz         - Magnetic field Z component (nT, body frame)
```

Optional for gradiometer mode:
```
Bx2, By2, Bz2  - Second sensor readings
```

## Deployment

### Vercel Deployment

1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

### Environment Variables on Vercel

Make sure to add all variables from `.env.example` in Vercel project settings.

### Post-Deployment

1. Update Stripe webhook endpoint to production URL
2. Update `NEXT_PUBLIC_APP_URL` to production domain
3. Configure Supabase redirect URLs for auth

## Performance

- Lighthouse scores: ≥90 on all metrics
- Image optimization with Next.js Image
- Route-level code splitting
- ISR for marketing pages
- Server-side rendering for dashboard

## Security

- Row-level security (RLS) in Supabase
- Signed URLs for file access
- CSRF protection on mutations
- Input validation with Zod
- Cookie-based auth with httpOnly

## Testing

```bash
# Run unit tests
npm test

# Type checking
npm run type-check

# Linting
npm run lint
```

## Support

- **Documentation**: Check `/docs` for detailed guides
- **Contact**: Use the contact form at `/support`
- **Issues**: Open an issue on GitHub

## License

Proprietary - All rights reserved

## Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Maps powered by [MapLibre GL](https://maplibre.org/)
- Payments by [Stripe](https://stripe.com/)
- Backend by [Supabase](https://supabase.com/)
