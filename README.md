# FluxSpace

**Autonomous magnetic mapping for hidden structural issues**

FluxSpace is a SaaS platform for processing drone magnetometer data to generate 2D and 3D magnetic anomaly maps used in structural and subsurface assessments. Users can upload flight log CSV files and receive georeferenced heatmaps and processed outputs in minutes.

## Features

- **Drone Data Processing** – Upload magnetometer CSV logs containing time, position, altitude, attitude, and magnetic field data.
- **Interactive Map Viewer** – View processed magnetic maps through MapLibre GL with adjustable heatmap overlays and color scales.
- **Dual-Sensor Support** – Automatically computes magnetic field gradients for higher anomaly sensitivity.
- **High Resolution Output** – Produces 10–25 cm resolution grids with automatic UTM projection.
- **Export Options** – Download results as GeoTIFFs, PNG previews, and CSV grids.
- **Stripe Integration** – Subscription-based billing with usage tracking.
- **Secure Authentication** – Managed through Supabase with row-level security.
- **Dark Mode Interface** – Consistent interface for both light and dark environments.

## Tech Stack

- **Framework:** Next.js 14 (App Router) with TypeScript
- **Styling:** TailwindCSS with shadcn/ui components
- **Auth & Database:** Supabase (Postgres + Storage)
- **Payments:** Stripe (Checkout and Customer Portal)
- **Maps:** MapLibre GL + deck.gl
- **Charts:** Recharts
- **Deployment:** Vercel

## Getting Started

### Requirements

- Node.js 18 or higher
- Supabase project and API keys
- Stripe account (test mode for development)

### Setup

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd fluxspace
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a local environment file:
   ```bash
   cp .env.example .env.local
   ```

4. Update `.env.local` with your own credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   STRIPE_STARTER_PRICE_ID=price_...
   STRIPE_PRO_PRICE_ID=price_...
   STRIPE_TEAM_PRICE_ID=price_...

   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

### Database Setup

Run the SQL commands in the Supabase SQL editor to create tables, policies, and storage buckets.  
(See the provided schema for details.)

### Stripe Setup

1. Create products and prices for each plan (Starter, Pro, Team).
2. Copy the price IDs into your `.env.local`.
3. Add a webhook endpoint pointing to `/api/stripe/webhook`.
4. Add the webhook signing secret to `STRIPE_WEBHOOK_SECRET`.

### Development

```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

### Seeding Demo Data

```bash
npm run seed
```
Creates a demo user (`demo@fluxspace.com`, password `demo123`) with a sample project and result set.

## Project Structure

```
fluxspace/
├── app/              # Next.js routes
│   ├── dashboard/    # User dashboard
│   ├── viewer/       # Map viewer
│   ├── api/          # API endpoints
│   └── ...
├── components/       # UI and shared components
├── lib/              # Utilities (Supabase, Stripe, helpers)
├── scripts/          # Tools and seed script
└── public/           # Static assets
```

## System Overview

### File Uploads

- Files are uploaded to Supabase Storage using presigned URLs.
- Upload metadata is stored in the `uploads` table.

### Processing Pipeline

1. Parse and validate magnetometer CSV input.
2. Convert sensor-frame magnetic data to Earth frame.
3. Calculate magnetic field magnitudes and gradients.
4. Apply filters and baseline corrections.
5. Interpolate and grid data at high spatial resolution.
6. Generate output files (GeoTIFF, PNG, CSV).

### Map Viewer

- Interactive visualization using MapLibre GL.
- Adjustable color ramps and opacity.
- Legend displays magnetic intensity or gradient.
- Download links for all output formats.

### Billing & Usage

- Stripe Checkout for plan subscriptions.
- Usage tracking by job count and storage consumption.
- Customer portal for managing subscriptions.

## Deployment

### Steps

1. Push code to GitHub and deploy through Vercel.
2. Add all required environment variables to Vercel.
3. Update Stripe webhooks and Supabase redirect URLs.

### After Deployment

- Verify webhook functionality.
- Confirm auth redirects and environment configuration.

## Security

- Supabase row-level security (RLS).
- Signed URLs for storage access.
- Input validation and sanitized queries.
- HTTP-only cookies for authentication.

## Testing

```bash
npm test
npm run type-check
npm run lint
```

## License

Proprietary – all rights reserved.

## Contact

For support or collaboration inquiries, use the contact form at `/support` or email the team directly.
