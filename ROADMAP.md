# SiteIntelica Feature Roadmap (Traffic & Growth Focus)

This document tracks the next 10 high-value features for SiteIntelica to maximize organic traffic, user retention, and viral growth, **without** requiring user accounts, authentication, or payment gateways.

## 📈 Virality & Growth 
1. **Tech Stack "Market Share" & Global Trends Dashboard**
   - **What:** A public `/trends` page showing aggregated stats from our local SQLite DB (e.g., "Top 10 Frontend Frameworks", "Most Scanned Domains This Week").
   - **Why:** Naturally generates highly shareable, data-driven content that developers and tech journalists love to link to, driving massive organic SEO traffic.

2. **Chrome Browser Extension**
   - **What:** A lightweight popup extension that "X-Rays" whatever website the user is currently browsing with a single click.
   - **Why:** Incredible product-led growth. Once installed, users rely on it daily without needing to navigate to SiteIntelica.com first.

3. **"Similar Sites" (Competitor Discovery) Engine**
   - **What:** When a user scans `stripe.com`, automatically suggest `paddle.com`, `braintree.com`, etc. at the bottom of the report.
   - **Why:** Keeps users on the platform longer. They come to spy on one competitor, and we give them three more to explore, increasing page views and ad impressions.

## 🕵️ Deep Intelligence (No-Auth)
4. **Third-Party Pixel & Tracker De-obfuscation**
   - **What:** Isolate and prominently display the exact advertising pixels loading on the site (e.g., Facebook Pixel, TikTok Pixel, LinkedIn Tag).
   - **Why:** Tells marketers exactly where their competitors are currently spending their advertising budget.

5. **Subdomain Enumeration (The "Shadow IT" Finder)**
   - **What:** Instead of just scanning the main domain, perform lightweight checks for common subdomains (`api.`, `staging.`, `dev.`, `blog.`) and link them.
   - **Why:** Reveals hidden infrastructure and unreleased product features competitors might try to hide.

6. **Historical Timeline & Diffing ("What Changed?")**
   - **What:** Since we store scans locally, we can build a UI that compares the *current* scan with the last recorded scan of that domain.
   - **Why:** Shows actionable intelligence like: "Competitor switched from Stripe to Braintree 2 weeks ago!" or "Competitor added Google Analytics!" 

## 🛡️ Security & Auditing
7. **Accessibility (a11y) & WCAG Compliance Auditor**
   - **What:** Expand the Lighthouse integration to extract and display critical accessibility failures (missing alt text, low color contrast).
   - **Why:** Accessibility lawsuits are a massive fear for businesses; flagging these issues attracts SEO and marketing agency traffic.

8. **Open Port & Vulnerability Scanner (Basic Penetration Test)**
   - **What:** Run a quick, safe network scan to see if dangerous ports (like 21 FTP, 22 SSH, 3306 MySQL) are exposed to the public internet on the target IP.
   - **Why:** Adds a "Security Audit" angle that attracts IT professionals, system administrators, and security researchers.

## 📊 Polish & Utility
9. **Visual Site Preview (Automated Screenshotting)**
   - **What:** Integrate a headless browser API (like Puppeteer or a free tier screenshot API) to capture and display a visual screenshot of the target site alongside the tech stack.
   - **Why:** Dramatically improves the visual appeal of the report and the generated PDF.

10. **Enhanced Custom PDF Export Generator**
    - **What:** Upgrade our current basic PDF export to generate a highly polished, branded, multi-page "Competitor Intelligence Report".
    - **Why:** Agencies love to generate these reports and hand them to their clients, passively marketing SiteIntelica in the process.
