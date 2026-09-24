# SaaSFinder — phased build plan

## Phase 0 — Foundation
- Next.js 16 / TypeScript / Tailwind
- responsive design system
- product/category data model
- SEO metadata, sitemap, robots
- core legal/editorial pages

## Phase 1 — Content engine
- database schema
- admin product CRUD
- review content model
- category/use-case taxonomy
- freshness timestamps
- changelog/version history
- FAQ model
- controlled publishing states

## Phase 2 — SEO engine
- canonical/OG metadata
- JSON-LD for products, breadcrumbs and FAQs
- dynamic internal-link graph
- category hubs
- product index
- alternatives pages
- comparison pages
- best-for/use-case pages
- thin-page/noindex controls
- sitemap segmentation

## Phase 3 — Comparison engine
- category-specific comparison schemas
- curated competitor relationships
- comparison matrix generator
- reusable pros/cons and best-for blocks
- related comparisons
- duplicate/cannibalization safeguards

## Phase 4 — Monetization
- affiliate-link database
- affiliate network/vendor mappings
- redirect/tracking service
- CTA placements
- campaign/subid tracking
- sponsor slots
- sponsor labeling and QA rules
- commercial/editorial separation

## Phase 5 — Analytics
- event schema
- outbound click tracking
- CTA placement tracking
- sponsor click tracking
- CPL submit tracking
- page/template performance
- affiliate CTR/RPM reporting
- optional GA4 integration

## Phase 6 — Freshness automation
- product refresh queue
- pricing snapshot workflow
- feature verification workflow
- stale-content detection
- scheduled refresh jobs
- change logs
- approval workflow before publication

## Phase 7 — Admin/CMS
- secure admin authentication
- product editor
- review editor
- comparison editor
- affiliate manager
- sponsor manager
- refresh queue
- publishing controls
- audit log

## Phase 8 — Quality/SEO automation
- automated broken-link checks
- metadata validation
- schema validation
- duplicate/cannibalization checks
- affiliate-link validation
- stale-price alerts
- sitemap validation
- Playwright critical-route tests
- CI gates

## Phase 9 — Production hardening
- PostgreSQL/Neon production database
- migrations/backups
- rate limiting
- security headers
- error monitoring
- caching/revalidation
- performance optimization
- accessibility audit
- legal/compliance finalization

## Phase 10 — Scale
- 3–7 content pages/week workflow
- keyword-cluster pipeline
- programmatic but quality-controlled pages
- editorial review queue
- GSC performance ingestion
- content opportunity dashboard
- sponsor eligibility thresholds
- revenue and content-health dashboards

### Completion rule
A phase is only marked complete after implementation plus verification. No phase should be described as complete merely because files/routes exist.
