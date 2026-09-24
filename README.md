# SaaSFinder

SEO-first SaaS reviews, alternatives and comparisons.

## Included
- Structured product catalog
- Searchable product index
- Product review pages with pricing snapshot dates
- Category hubs
- Alternatives-to pages
- Product-vs-product comparison pages
- Tracked vendor routing with verified-affiliate fallback behavior
- Clearly labeled sponsor placeholder
- Analytics event endpoint
- Sitemap and robots
- Methodology, disclosure, privacy and contact pages
- CI typecheck/lint/build workflow

## Local
Run npm install, then npm run dev. Set NEXT_PUBLIC_SITE_URL in production.

## Commercial setup
The seed catalog intentionally uses official vendor URLs because affiliate relationships have not been verified. Only enable affiliateAvailable and set affiliateUrl after a real partner relationship exists.

## Production work still required
Replace seed data with a database/admin workflow, persist analytics to a real provider, verify affiliate programs, add automated freshness jobs, add legal/company details, and expand automated QA. The repository contains the functional site foundation; those external integrations require real credentials and business decisions.