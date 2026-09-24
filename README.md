# SaaSFinder

SEO-first SaaS reviews, alternatives and comparisons.

## Implemented

- Structured PostgreSQL/Prisma product catalog with publishing states
- Product reviews, FAQs, dated pricing/content snapshots and changelog
- Category hubs, product index and searchable catalog
- Alternatives-to pages and product-vs-product comparison pages
- Protected admin CRUD for products, categories, FAQs, snapshots, links, alternatives, refreshes, changelog and sponsors
- Affiliate redirect with explicit `nofollow sponsored` CTA treatment
- Sponsor placements with explicit commercial/editorial separation
- Analytics event collection with bounded metadata and protected admin reporting
- Freshness queue with protected cron endpoint and daily Vercel Cron schedule
- Protected cache revalidation endpoint for content updates
- Canonicals, Open Graph metadata, JSON-LD, sitemap and robots
- HTTP(S) URL, status, snapshot, rating and cron/admin authentication validation
- CI workflow for install, Prisma generation, tests, typecheck, lint and production build

## Local development

```bash
npm install
npm run dev
```

For database-backed local development, set `DATABASE_URL`. Without a database the public catalog uses the local seed dataset.

## Required production environment

- `DATABASE_URL` — PostgreSQL/Neon connection string
- `NEXT_PUBLIC_SITE_URL` — real canonical production origin
- `ADMIN_API_KEY` — strong secret for admin API routes
- `CRON_SECRET` — strong secret for the freshness cron endpoint

Never commit real secrets.

## Freshness behavior

The scheduled freshness endpoint creates review tasks for published products whose latest content/pricing snapshot is older than the configured threshold. It deliberately does **not** scrape vendors, invent prices, or auto-publish changes. A human/editorial workflow must verify the vendor source and then add a new snapshot/changelog entry.

## Commercial data

The seed catalog uses official vendor URLs because affiliate relationships have not been verified. Enable affiliate links only after a real partner relationship exists.

## Launch blockers requiring real business inputs

The codebase cannot truthfully invent these:

- legal entity/contact details and final privacy/cookie language
- verified affiliate network accounts and tracking parameters
- real sponsor/CPL agreements
- verified live vendor pricing/features for production content
- production PostgreSQL credentials and admin/cron secrets
- final production domain

These should be supplied during the final deployment/launch phase.
