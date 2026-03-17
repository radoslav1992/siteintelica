# SiteIntelica

Advanced tech stack analyzer and competitor intelligence platform. X-Ray any website to reveal exactly how it's built, secured, and monetized.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Astro 5.x (SSR) with Inter font family |
| Backend | Astro API routes + Node.js (standalone adapter) |
| Database | SQLite (better-sqlite3) with WAL mode |
| Auth | Lucia 3.x + oslo (Argon2id password hashing) |
| Engine | Rust (Axum, Tokio) for port scanning on port 8080 |
| Tech Detection | wapalyzer-core, cheerio |
| AI | Google Gemini (optional, dynamic import) |
| Testing | Vitest |

## Features

### Core (Free Tier)

- **Tech Stack Detection** — Wappalyzer-based deep DOM analysis with categorized results
- **Security Audit** — A–F security grade, HTTP headers, SSL/TLS, SPF/DMARC
- **SEO Analysis** — Meta tags, Core Web Vitals, sitemap, robots.txt
- **Performance Scores** — Lighthouse Performance, SEO, and Accessibility via PageSpeed API
- **CrUX Real User Metrics** — Chrome UX Report field data (LCP, CLS, INP, FCP, TTFB)
- **Infrastructure Intelligence** — IP-to-ASN cloud provider detection with hosting tier classification
- **Global Tech Trends** — `/trends` aggregated stats with clickable deep dives
- **Technology Deep Dives** — `/tech/[slug]` pages with adoption rate and companion techs
- **Leaderboard** — Most-scanned domains
- **Public Reports** — Shareable `/report/[domain]` pages
- **Embeddable Badges** — SVG shields for README files
- **Blog** — Markdown-powered blog with SEO schema markup

### Premium (Requires Account)

#### Deep Security Scanning
- **Known Vulnerability Detection** — Cross-reference detected technologies against CVE database (jQuery, Angular, Bootstrap, Lodash, Moment.js, WordPress, etc.)
- **CSP Deep Analysis** — Parse and score Content-Security-Policy directives, detect unsafe-inline, unsafe-eval, wildcards, missing directives
- **Mixed Content Detection** — Find HTTP resources loaded on HTTPS pages (scripts, stylesheets, images, iframes, fonts)
- **Third-Party Risk Scoring** — Assess privacy/security risk of every external domain loaded (session recorders, ad trackers, CDNs)
- **Overall Risk Score** — 0-100 composite risk rating with severity-weighted scoring

#### Advanced SEO & Accessibility
- **WCAG Accessibility Audit** — Check images alt text, form labels, heading hierarchy, ARIA usage, skip navigation, tabindex, color contrast heuristics
- **Schema.org Validator** — Deep validation of JSON-LD structured data with required field checks and Google Rich Results eligibility
- **Page Weight Analysis** — Estimate total page weight by resource type (scripts, styles, images, fonts, iframes) with A-F grading
- **Duplicate Content Detection** — Check title/description length, OG tag presence, canonical URL, H1 count
- **International SEO** — Hreflang tag detection and validation

#### Business Intelligence
- **Multi-Source Traffic Estimation** — Tranco + CrUX + backlinks + tech heuristics
- **Domain Authority Score** — Performance, SEO, security, content quality, and crawlability factors
- **Tech Stack Cost Calculator** — Estimate monthly SaaS spend from detected technologies
- **Carbon Footprint Estimate** — CO₂ per page view with yearly tree equivalence
- **Ad Revenue Estimator** — Based on detected ad networks and traffic estimates
- **Hosting Cost Estimate** — Cloud/hosting tier detection with traffic-scaled cost ranges

#### Domain Monitoring (`/monitoring`)
- **Watchlist Management** — Add up to 25 competitor domains with custom labels
- **Flexible Check Intervals** — Hourly, daily, or weekly monitoring
- **Change Detection** — Tech stack diff between scans with added/removed technologies
- **In-App Notifications** — Real-time alerts when monitored domains change
- **Monitoring Dashboard** — Security grade, performance score, and tech count at a glance

#### Lead Generation (`/leads`)
- **Technology-Based Search** — "Show me all domains using WordPress + WooCommerce but not Cloudflare"
- **Boolean Filters** — Include AND exclude technology filters
- **Technology Adoption Stats** — See which technologies are most popular across scanned domains
- **CSV Export** — Download filtered lead lists as CSV
- **Click-to-Add** — Click any technology stat to add it to your search filter

#### Bulk Analysis
- **Real Batch Scanning** — Upload CSV/TXT with up to 50 URLs for sequential scanning
- **Wappalyzer Detection** — Each URL gets full tech stack analysis
- **Job Tracking** — View recent bulk jobs with status (pending/processing/complete)
- **JSON Export** — Download complete bulk results as JSON

#### Historical Intelligence
- **Tech Stack Timeline** — `/api/history/[domain]` returns all scans with tech stack diffs
- **Performance Trends** — Track Lighthouse scores over time
- **Security Score History** — Monitor security posture changes
- **Tech Stack Diffs** — See exactly which technologies were added/removed between scans

#### Data Export
- **CSV Export** — Download scan history as CSV
- **JSON Export** — Full scan data export
- **Per-Domain History** — Export timeline for specific domains

#### Notifications (`/notifications`)
- **Change Alerts** — Notified when monitored domains change tech stack
- **Security Alerts** — Warned about security regressions
- **Mark Read/Unread** — Manage notification state
- **Type-Based Icons** — Monitor, security, performance, SSL, and system notification types

#### Developer API
- **REST API** — Bearer token authentication with API keys
- **Rate Limiting** — Per-user daily limits (Free: 10, Pro: 200, Enterprise: unlimited)
- **API Usage Tracking** — Dashboard shows today/week/month request counts
- **Webhook Integration** — Configure webhook URL for real-time event delivery
- **Audit Logging** — All actions logged with user, action, target, and IP

### Premium AI Features

- **Executive Summary & SWOT** — AI-generated business analysis via Gemini
- **Cold Email Generator** — Tech-aware personalized outreach drafts
- **Tech Upgrade Recommendations** — AI suggestions for outdated/vulnerable stacks
- **SEO Scorecard** — Comprehensive AI-powered SEO report
- **Competitor Gap Analysis** — AI comparison of two scanned domains

## Commands

| Command | Action |
|:--------|:-------|
| `npm install` | Install dependencies |
| `npm run dev` | Start Astro dev server at `localhost:4321` |
| `npm run dev:all` | Start Astro + Rust engine (requires `concurrently`) |
| `npm run build` | Build production site to `./dist/` |
| `npm run preview` | Preview production build locally |
| `npm test` | Run Vitest test suite |
| `npm run test:watch` | Run tests in watch mode |

## Project Structure

```
src/
├── components/          # Reusable Astro components
├── content/blog/        # Markdown blog posts
├── db/client.ts         # SQLite schema, tables, CRUD, search, monitoring, notifications, audit, rate limiting
├── layouts/             # Layout with responsive nav (dynamic nav items for logged-in users)
├── lib/auth.ts          # Lucia auth configuration
├── middleware.ts         # Session validation + API usage logging
├── pages/               # Routes (SSR pages + API endpoints)
│   ├── api/
│   │   ├── analyze.ts   # Main scan endpoint (deep security + advanced SEO + rate limiting)
│   │   ├── bulk-analyze.ts # Real batch scanning with sequential processing
│   │   ├── monitor.ts   # Watchlist CRUD (add/remove/list)
│   │   ├── leads.ts     # Technology search & lead generation
│   │   ├── notifications.ts # Notification management
│   │   ├── export.ts    # CSV/JSON data export
│   │   ├── history/     # Per-domain scan timeline
│   │   ├── badge/       # SVG badge generator
│   │   ├── ai/          # AI endpoints (summary, email, upgrades, seo-audit, competitor-gap)
│   │   └── user/        # Webhook config, usage stats
│   ├── dashboard.astro  # Premium command center with stats, actions, API keys
│   ├── monitoring.astro # Domain monitoring management
│   ├── leads.astro      # Technology search & lead generation
│   ├── notifications.astro # Notification center
│   ├── blog/            # Blog pages
│   ├── history/         # Scan timeline per domain
│   ├── tech/            # Technology deep dive pages
│   ├── report/          # Public domain reports
│   └── ...              # Other pages (trends, compare, leaderboard, etc.)
├── scripts/             # Client-side scripts
├── styles/global.css    # Design system (CSS variables, components)
└── utils/               # Business logic
    ├── accessibility.ts # Automated accessibility audit
    ├── advanced-seo.ts  # Schema validation, page weight, duplicate content, i18n SEO
    ├── backlinks.ts     # CommonCrawl + Open PageRank backlink estimation
    ├── business-intel.ts# Multi-source traffic, cost, carbon, authority calculators
    ├── crux.ts          # Chrome UX Report API client
    ├── deep-security.ts # CVE lookup, CSP analysis, mixed content, 3rd-party risk scoring
    ├── ip-intel.ts      # IP-to-ASN cloud provider detection
    ├── gemini.ts        # Google Gemini AI client
    ├── keyword-intel.ts # Keyword visibility & search intent analysis
    ├── rate-limit.ts    # API rate limiting & usage tracking
    ├── security-grade.ts# Security header grading
    ├── seo-tools.ts     # SEO audit, readability, links, cookies
    ├── subdomain-enum.ts# DNS subdomain enumeration
    ├── tranco.ts        # Tranco domain ranking lookup
    └── wayback.ts       # Wayback Machine CDX API client

engine/                  # Rust port scanner service (Axum on :8080)
tests/                   # Vitest test suite for utility functions
```

## Database Schema

| Table | Purpose |
|-------|---------|
| `scans` | Stored scan results (domain, scan_data JSON, user_id, timestamp) |
| `user` | Users with auth, API keys, plan tier, scan quotas |
| `session` | Lucia session management |
| `monitored_domains` | Domain watchlist per user with check intervals |
| `notifications` | In-app notifications (tech changes, security alerts, etc.) |
| `audit_log` | All user actions logged with metadata and IP |
| `bulk_jobs` | Batch scan job tracking with status and results |
| `api_usage` | Per-request API usage logging with latency and status |

## Environment

Copy `.env.example` to `.env` and configure:

```
GEMINI_API_KEY=your_gemini_key_here
CRUX_API_KEY=your_google_api_key_here
OPEN_PAGERANK_KEY=your_openpagerank_key_here
```

- The Rust engine must be running on `127.0.0.1:8080` for premium port scanning
- `@google/generative-ai` is optional and dynamically imported for AI features
- SQLite database is stored at `siteintelica_scans.db` in the project root

## Testing

```bash
npm test          # Run once
npm run test:watch # Watch mode
```

Test coverage includes: security grading, business metrics, SEO analysis, accessibility audits, readability scoring, Tranco traffic estimation, keyword intelligence, and IP-to-provider mapping.
