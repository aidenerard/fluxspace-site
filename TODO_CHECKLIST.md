# FluxSpace - Implementation Checklist

## 🔴 Critical (Core Functionality)

### Processing Pipeline
- [ ] Create processing service/function
  - [ ] CSV parsing with validation
  - [ ] Quaternion-based frame rotation (body → earth)
  - [ ] Magnetic field calculation (|B| or ΔB)
  - [ ] Low-pass filtering
  - [ ] Baseline removal
  - [ ] UTM projection
  - [ ] Grid interpolation (IDW or scipy griddata)
  - [ ] GeoTIFF generation with CRS
  - [ ] PNG preview generation
  - [ ] CSV export (x, y, value)
  - [ ] Update job status in database
  - [ ] Store results in Supabase Storage

### File Upload
- [ ] Create upload page/component
- [ ] Implement drag-and-drop with react-dropzone
- [ ] Generate presigned URL (`/api/uploads/sign`)
- [ ] Upload directly to Supabase Storage
- [ ] Show upload progress
- [ ] Validate file size (2GB limit)
- [ ] Validate CSV structure
- [ ] Create upload record in database
- [ ] Update storage usage counter

### Map Viewer
- [ ] Create `/viewer/[jobId]/page.tsx`
- [ ] Integrate MapLibre GL
- [ ] Add basemap layer (OSM, satellite, etc.)
- [ ] Load result GeoTIFF as raster layer
- [ ] Implement heatmap overlay
- [ ] Add color ramp selector (Viridis, Inferno, Magma, Plasma)
- [ ] Add opacity slider
- [ ] Display legend with nT values
- [ ] Add download buttons (GeoTIFF, PNG, CSV)
- [ ] Optional: Add orthomosaic overlay support
- [ ] Optional: Add 3D view with Cesium

## 🟡 Important (Full SaaS Features)

### Stripe Integration
- [ ] Implement Checkout flow
  - [ ] Create checkout session endpoint
  - [ ] Redirect to Stripe Checkout
  - [ ] Handle success/cancel redirects
- [ ] Set up webhook handler (`/api/stripe/webhook`)
  - [ ] Handle `checkout.session.completed`
  - [ ] Handle `customer.subscription.created`
  - [ ] Handle `customer.subscription.updated`
  - [ ] Handle `customer.subscription.deleted`
  - [ ] Update user's stripe_customer_id
  - [ ] Handle subscription status changes
- [ ] Create Customer Portal endpoint
  - [ ] Generate portal session
  - [ ] Handle subscription changes
- [ ] Implement plan limit enforcement
  - [ ] Check project count before creation
  - [ ] Check monthly job limit before processing
  - [ ] Check storage limit before upload
  - [ ] Show upgrade prompts when limits reached

### Project Management
- [ ] Create project detail page (`/dashboard/projects/[id]`)
- [ ] List uploads in project
- [ ] List jobs in project
- [ ] Add project settings (rename, delete)
- [ ] Implement project deletion with cascading
- [ ] Add project search/filter

### Account Management
- [ ] Create account page (`/account`)
- [ ] Show user profile
- [ ] Allow name/email updates
- [ ] Display API key (generate if needed)
- [ ] Link to Stripe Customer Portal
- [ ] Show billing history
- [ ] Display current plan and usage
- [ ] Add usage progress bars

## 🟢 Nice to Have (Enhancements)

### Notifications
- [ ] Set up email service (Resend, SendGrid, etc.)
- [ ] Send email verification on signup
- [ ] Send job completion emails
- [ ] Send usage limit warnings (80%, 90%, 100%)
- [ ] Send monthly usage summaries

### User Experience
- [ ] Add loading states to all async operations
- [ ] Improve error messages
- [ ] Add skeleton loaders
- [ ] Add empty states for all lists
- [ ] Add confirmation dialogs for destructive actions
- [ ] Add keyboard shortcuts
- [ ] Add tooltips for technical terms
- [ ] Add onboarding tour for new users

### Additional Pages
- [ ] Create support page (`/support`)
  - [ ] Contact form
  - [ ] Knowledge base search
  - [ ] FAQs
- [ ] Create legal pages (`/legal`)
  - [ ] Terms of Service
  - [ ] Privacy Policy
  - [ ] Acceptable Use Policy
- [ ] Create changelog page
- [ ] Create status page

### Advanced Features
- [ ] Add batch processing (multiple files)
- [ ] Add project templates
- [ ] Add data export (all results as ZIP)
- [ ] Add collaboration features (team accounts)
- [ ] Add API access with rate limiting
- [ ] Add webhooks for job completion
- [ ] Add integration with GIS software
- [ ] Add mobile app (React Native)

## 🔧 Technical Improvements

### Testing
- [ ] Set up Jest + React Testing Library
- [ ] Write unit tests for utilities
- [ ] Write integration tests for API routes
- [ ] Write E2E tests with Playwright
- [ ] Set up CI/CD pipeline
- [ ] Add test coverage reporting

### Performance
- [ ] Optimize images with next/image
- [ ] Implement lazy loading
- [ ] Add Redis caching for API responses
- [ ] Optimize database queries (add indexes)
- [ ] Implement pagination for lists
- [ ] Add service worker for offline support
- [ ] Optimize bundle size

### Security
- [ ] Add rate limiting to API routes
- [ ] Implement CSRF protection
- [ ] Add input sanitization with Zod
- [ ] Set up security headers
- [ ] Add audit logging
- [ ] Implement 2FA
- [ ] Add session management
- [ ] Regular security audits

### Monitoring & Analytics
- [ ] Set up error tracking (Sentry)
- [ ] Add custom analytics events
- [ ] Create admin dashboard
- [ ] Add usage analytics
- [ ] Set up uptime monitoring
- [ ] Add performance monitoring
- [ ] Create alerts for errors/downtime

### Documentation
- [ ] Add API documentation
- [ ] Create component Storybook
- [ ] Write contributing guide
- [ ] Add deployment guide
- [ ] Create video tutorials
- [ ] Add code examples
- [ ] Document processing algorithms

## 📝 Priority Order

**Phase 1 (MVP):**
1. Processing pipeline
2. File upload
3. Basic map viewer
4. Stripe checkout

**Phase 2 (Beta):**
1. Project management
2. Account management
3. Email notifications
4. Plan enforcement

**Phase 3 (Launch):**
1. Support pages
2. Legal pages
3. Testing suite
4. Performance optimizations

**Phase 4 (Growth):**
1. Advanced features
2. Mobile app
3. API access
4. Integrations

## 🎯 Success Metrics

- [ ] Users can sign up and create projects
- [ ] Users can upload CSV files
- [ ] Processing completes in <5 minutes
- [ ] Map viewer renders results correctly
- [ ] Users can subscribe via Stripe
- [ ] Plan limits are enforced
- [ ] Users can download results
- [ ] 90+ Lighthouse scores
- [ ] <100ms API response times
- [ ] 99.9% uptime

---

**Note**: This checklist represents the roadmap from foundation to production SaaS. The current codebase provides a solid foundation - focus on implementing the core processing pipeline and viewer first, then expand features based on user feedback.
