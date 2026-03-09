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

## Features

- **Tech Stack Detection** - Wappalyzer-based deep DOM analysis
- **Security Audit** - Security grade, headers, SSL, SPF/DMARC
- **SEO Analysis** - Meta tags, Core Web Vitals, sitemap, robots.txt
- **Business Intelligence** - Traffic estimation, domain authority, tech costs, carbon footprint
- **AI Suite** - Executive summaries, cold email generation, upgrade tips, SEO audits (Gemini)
- **Premium** - Subdomain enumeration, open port scanning, ad trackers, cookie/GDPR scan
- **Comparison** - Side-by-side competitor analysis
- **Bulk Scanning** - Analyze up to 50 URLs at once

## Commands

| Command | Action |
|:--------|:-------|
| `npm install` | Install dependencies |
| `npm run dev` | Start Astro dev server at `localhost:4321` |
| `npm run dev:all` | Start Astro + Rust engine (requires `concurrently`) |
| `npm run build` | Build production site to `./dist/` |
| `npm run preview` | Preview production build locally |

## Project Structure

```
src/
├── components/       # Reusable Astro components
├── content/blog/     # Markdown blog posts
├── db/client.ts      # SQLite schema, CRUD operations
├── layouts/          # Layout with responsive nav
├── lib/auth.ts       # Lucia auth configuration
├── middleware.ts      # Session validation
├── pages/            # Routes (SSR pages + API endpoints)
│   ├── api/          # REST API (analyze, auth, AI, bulk)
│   ├── blog/         # Blog pages
│   └── report/       # Public domain reports
├── scripts/          # Client-side scripts
├── styles/global.css # Design system (CSS variables, components)
└── utils/            # Business logic (security, SEO, business intel)

engine/               # Rust port scanner service (Axum on :8080)
```

## Environment

- The Rust engine must be running on `127.0.0.1:8080` for premium port scanning features
- `@google/generative-ai` is optional and dynamically imported for AI features
- SQLite database is stored at `siteintelica_scans.db` in the project root
