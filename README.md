# FluxSpace

**Autonomous magnetic mapping for hidden structural issues**

FluxSpace is a SaaS platform for processing drone magnetometer data to generate 2D and 3D magnetic anomaly maps used in structural and subsurface assessments. Users can upload flight log CSV files and receive georeferenced heatmaps and processed outputs in minutes.

## Features

### Core Functionality
- **Drone Data Processing** – Upload magnetometer CSV logs containing time, position, altitude, attitude, and magnetic field data
- **Interactive Map Viewer** – View processed magnetic maps through MapLibre GL with adjustable heatmap overlays and color scales
- **Dual-Sensor Support** – Automatically computes magnetic field gradients for higher anomaly sensitivity
- **High Resolution Output** – Produces 10–25 cm resolution grids with automatic UTM projection
- **Export Options** – Download results as GeoTIFFs, PNG previews, and CSV grids

### User Experience
- **Enhanced Navigation** – Dropdown menu system with mobile-responsive hamburger menu
- **AI-Powered Chatbot** – Interactive support assistant with keyword-based responses
- **Contact System** – Professional contact form with validation
- **Why FluxSpace Page** – Comprehensive comparison with traditional methods
- **Dark Mode Interface** – Full dark/light theme support

### Business Features
- **Stripe Integration** – Subscription-based billing with usage tracking
- **Three Pricing Tiers** – Starter (Free), Pro ($29/mo), Team ($99/mo)
- **Secure Authentication** – Managed through Supabase with row-level security
- **Usage Monitoring** – Track jobs per month and storage consumption

## Tech Stack

- **Framework:** Next.js 14 (App Router) + TypeScript
- **Styling:** TailwindCSS + shadcn/ui components
- **Auth & Database:** Supabase (Postgres + Storage)
- **Payments:** Stripe (Checkout + Customer Portal)
- **Maps:** MapLibre GL + deck.gl
- **Charts:** Recharts
- **Deployment:** Vercel

## Quick Start

```bash
# Clone and install
git clone https://github.com/aidenerard/fluxspace.git
cd fluxspace
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your keys

# Set up database (run SQL from SETUP.md in Supabase)
# Create storage buckets in Supabase

# Seed demo data
npm run seed

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

**Demo Login:**
- Email: demo@fluxspace.com
- Password: demo123

## Documentation

- **README.md** (this file) – Project overview
- **SETUP.md** – Detailed setup with SQL schema
- **TODO_CHECKLIST.md** – Implementation roadmap
- **PROJECT_SUMMARY.md** – Architecture overview
- **🚀_START_HERE.md** – Quick start guide

## Project Structure

```
fluxspace/
├── app/                    # Next.js pages
│   ├── page.tsx           # Landing page
│   ├── dashboard/         # User dashboard
│   ├── product/           # Product features
│   ├── pricing/           # Pricing tiers
│   ├── docs/              # Documentation
│   ├── why-fluxspace/     # Benefits page
│   ├── contact/           # Contact form
│   ├── support/           # AI chatbot
│   ├── signin/signup/     # Auth pages
│   └── api/               # API routes
├── components/            # React components
│   ├── navbar.tsx        # Enhanced navigation
│   └── ui/               # shadcn/ui components
├── lib/                  # Utilities
│   ├── supabase.ts      # Database client
│   ├── stripe.ts        # Payment config
│   └── utils.ts         # Helpers
└── scripts/seed.ts      # Demo data
```

## Key Features Implemented

✅ **Complete UI/UX**
- Landing page with hero and features
- Product, Pricing, Docs pages
- Enhanced navigation with dropdown menu
- Mobile hamburger menu
- Dark mode support

✅ **Authentication**
- Sign up / Sign in pages
- Supabase auth integration
- Protected dashboard routes

✅ **Database**
- Full schema with RLS policies
- Users, projects, uploads, jobs, usage tables
- Storage buckets for files

✅ **New Pages**
- Why FluxSpace (comparison & use cases)
- Contact (form with validation)
- Support (AI chatbot + FAQs)

✅ **Payment Structure**
- Three pricing tiers defined
- Stripe configuration ready
- Usage tracking schema

## What Needs Implementation

🔨 **Priority 1 (Core Features)**
- [ ] File upload with drag-and-drop
- [ ] Processing pipeline (CSV → GeoTIFF)
- [ ] Map viewer with heatmap overlay
- [ ] Stripe webhook handlers

🔨 **Priority 2 (Polish)**
- [ ] Project detail pages
- [ ] Account management page
- [ ] Plan limit enforcement
- [ ] Email notifications

See `TODO_CHECKLIST.md` for complete roadmap.

## CSV Data Format

```csv
time,lat,lon,alt,roll,pitch,yaw,Bx,By,Bz
1678901234.5,37.7749,-122.4194,100.0,0.1,-0.2,45.3,25000,1500,-40000
```

**Required columns:**
- time (Unix timestamp)
- lat, lon (WGS84 degrees)
- alt (meters)
- roll, pitch, yaw (degrees)
- Bx, By, Bz (nanoTeslas, body frame)

**Optional:** Bx2, By2, Bz2 for gradiometer

## Deployment

### Vercel

```bash
# Push to GitHub
git push origin main

# Deploy on Vercel
# 1. Import from GitHub
# 2. Add environment variables
# 3. Deploy
```

### Post-Deployment
- Update Stripe webhook URL
- Configure Supabase redirect URLs
- Set production app URL

## Security

- Row-Level Security (RLS) on all tables
- Signed URLs for file access
- HTTP-only cookies for auth
- Input validation with Zod
- Environment secrets never committed

## Support & Contact

- **AI Chatbot:** Visit `/support`
- **Contact Form:** Visit `/contact`
- **Documentation:** Visit `/docs`
- **GitHub:** [aidenerard/fluxspace](https://github.com/aidenerard/fluxspace)

## License

Proprietary – All rights reserved

---

**Built for structural engineers and inspection professionals** 🚀
