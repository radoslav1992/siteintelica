# SiteIntelica

Advanced tech stack analyzer and competitor intelligence tool. X-Ray any website to reveal exactly how it's built, secured, and monetized.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Astro 5.x (SSR) with Inter font family |
| Backend | Astro API routes + Node.js (standalone adapter) |
| Database | SQLite (better-sqlite3) |
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
- **CrUX Real User Metrics** — Chrome UX Report field data (LCP, CLS, INP, FCP, TTFB) with good/needs-work/poor distribution bars
- **Infrastructure Intelligence** — IP-to-ASN cloud provider detection (AWS, GCP, Cloudflare, Hetzner, etc.) with hosting tier classification
- **Global Tech Trends** — `/trends` aggregated stats with clickable deep dives into each technology
- **Technology Deep Dives** — `/tech/[slug]` pages showing adoption rate, companion techs, and performance distribution
- **Leaderboard** — Most-scanned domains
- **Public Reports** — Shareable `/report/[domain]` pages for any scanned site
- **Embeddable Badges** — SVG shields for README files: `/api/badge/[domain]/security|performance|seo|tech-count`
- **Blog** — Markdown-powered blog with SEO schema markup

### Premium (Requires Account)

- **Business Intelligence** — Multi-source traffic estimation (Tranco + CrUX + backlinks + tech heuristics), domain authority with backlink factor, tech costs, carbon footprint, ad revenue
- **Backlink Profile** — Referring domain count via CommonCrawl, PageRank score via Open PageRank API, sample referring domains
- **Keyword Intelligence** — On-page keyword extraction with prominence scoring, search intent classification, topic clusters, content gap detection
- **Accessibility Audit** — Automated a11y checks: alt text, landmarks, heading hierarchy, zoom, ARIA, and more
- **Side-by-Side Comparison** — Dual-bar score comparison, tech overlap/diff, AI-powered gap analysis
- **Competitor Monitoring** — Watchlist up to 20 domains with real-time SSE updates when stacks change
- **Scan History Timeline** — `/history/[domain]` with performance charts, tech diff timeline, and full scan table
- **Wayback Machine Integration** — Query archived snapshots and page counts from the Internet Archive
- **Subdomain Enumeration** — DNS-based discovery of hidden subdomains
- **Port Scanner** — Rust-powered open port detection
- **Ad Tracker De-obfuscation** — Pixel IDs for Facebook, Google, TikTok, etc.
- **Cookie & GDPR Scan** — Cookie flags, consent banner detection, compliance issues
- **Structured Data Validator** — JSON-LD and Microdata schema detection
- **Social Media Profiling** — Platform detection with handles
- **API Rate Limiting** — Per-user/per-key rate limiting with usage tracking dashboard

### Premium AI Features

- **Executive Summary & SWOT** — AI-generated business analysis via Gemini
- **Cold Email Generator** — Tech-aware personalized outreach drafts
- **Tech Upgrade Recommendations** — AI suggestions for outdated or vulnerable stacks
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
├── db/client.ts         # SQLite schema, CRUD, aggregation queries
├── layouts/             # Layout with responsive nav
├── lib/auth.ts          # Lucia auth configuration
├── middleware.ts         # Session validation
├── pages/               # Routes (SSR pages + API endpoints)
│   ├── api/             # REST API
│   │   ├── analyze.ts   # Main scan endpoint (with rate limiting)
│   │   ├── badge/       # SVG badge generator
│   │   ├── wayback.ts   # Wayback Machine integration
│   │   ├── monitor.ts   # Watchlist CRUD
│   │   ├── monitor/     # SSE event stream
│   │   ├── ai/          # AI endpoints (summary, email, upgrades, seo-audit, competitor-gap)
│   │   └── user/        # Webhook, usage stats
│   ├── blog/            # Blog pages
│   ├── history/         # Scan timeline per domain
│   ├── tech/            # Technology deep dive pages
│   ├── report/          # Public domain reports
│   └── monitor.astro    # Competitor monitoring dashboard
├── scripts/             # Client-side scripts
├── styles/global.css    # Design system (CSS variables, components)
└── utils/               # Business logic
    ├── accessibility.ts # Automated accessibility audit
    ├── backlinks.ts     # CommonCrawl + Open PageRank backlink estimation
    ├── business-intel.ts# Multi-source traffic, cost, carbon, authority calculators
    ├── crux.ts          # Chrome UX Report API client (real-user metrics)
    ├── ip-intel.ts      # IP-to-ASN cloud provider detection
    ├── gemini.ts        # Google Gemini AI client
    ├── rate-limit.ts    # API rate limiting & usage tracking
    ├── keyword-intel.ts # Keyword visibility & search intent analysis
    ├── security-grade.ts# Security header grading
    ├── seo-tools.ts     # SEO audit, readability, links, cookies
    ├── subdomain-enum.ts# DNS subdomain enumeration
    ├── tranco.ts        # Tranco domain ranking lookup
    └── wayback.ts       # Wayback Machine CDX API client

engine/                  # Rust port scanner service (Axum on :8080)
tests/                   # Vitest test suite for utility functions
```

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

The project includes a Vitest test suite covering all pure utility functions:

```bash
npm test          # Run once
npm run test:watch # Watch mode
```

Test coverage includes: security grading, business metrics, SEO analysis, accessibility audits, readability scoring, Tranco traffic estimation, keyword intelligence, and IP-to-provider mapping.
