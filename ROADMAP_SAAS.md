# SiteIntelica SaaS Roadmap

With the foundational authentication and SaaS engine (Lucia + SQLite) now live, we can shift focus to building features that actively drive conversions. 

The goal is to provide enough value in the **Free Tier** to generate massive SEO traffic, while gating high-value, compute-intensive features behind the **Premium Tier** to encourage account creation and eventual monetization.

---

## 🟢 Free Tier (Anonymous Traffic Generators)
*These features are designed to rank on Google, generate backlinks, and get users addicted to the tool so they eventually create an account.*

1. **Tech Stack "Market Share" & Global Trends Dashboard**
   - **What:** A public `/trends` page showing aggregated stats from our local SQLite DB (e.g., "Top 10 Frontend Frameworks", "Most Scanned Domains This Week").
   - **Why:** Naturally generates highly shareable, data-driven content that developers and tech journalists love to link to.

2. **Chrome Browser Extension (Lite)**
   - **What:** A lightweight popup extension that "X-Rays" whatever website the user is currently browsing with a single click.
   - **Why:** Incredible product-led growth. Users rely on it daily without needing to navigate to SiteIntelica.com first.

3. **"Similar Sites" (Competitor Discovery)**
   - **What:** When a user scans `stripe.com`, automatically suggest `paddle.com`, `braintree.com`, etc., at the bottom of the report.
   - **Why:** Keeps users on the platform longer, increasing page views and ad impressions.

4. **Visual Site Preview (Automated Screenshotting)**
   - **What:** Integrate a headless browser API to capture and display a visual screenshot of the target site alongside the tech stack.
   - **Why:** Dramatically improves the visual appeal of the report and the generated PDF.

---

## 🔒 Premium Tier (Requires Logged-In Account)
*These features require significant backend processing or provide extreme competitive advantages, making them perfect candidates for paid SaaS plans in the future.*

1. **Advanced Bulk CSV Processing (Scale)**
   - **What:** Expand the current Bulk Scanner. Allow users to upload up to 1,000 URLs. The server processes them via a background worker queue and emails them a ZIP file containing the JSON reports when finished.
   - **Why:** Enterprise sales teams and lead generation agencies need to scan thousands of domains at once. This is a highly monetizable feature.

2. **Subdomain Enumeration & "Shadow IT" Discovery**
   - **What:** Instead of just scanning the main domain, perform intensive DNS checks for common subdomains (`api.`, `staging.`, `dev.`, `blog.`) and actively scan them.
   - **Why:** Reveals hidden infrastructure and unreleased product features competitors are trying to hide. This is an expensive operation that requires an account.

3. **Continuous Competitor Monitoring & Alerts**
   - **What:** A user adds a competitor's URL to their "Watchlist" in the Dashboard. SiteIntelica automatically scans it every 24 hours behind the scenes.
   - **Why:** If the competitor adds a new technology (like switching from Stripe to Braintree), the user receives an immediate email alert. High recurring value.

4. **Third-Party Pixel & Advertising Tracker De-obfuscation**
   - **What:** Isolate and prominently display the exact advertising pixels loading on the site (e.g., Facebook Pixel, TikTok Pixel, LinkedIn Tag) with their specific account IDs.
   - **Why:** Tells marketers exactly where their competitors are currently spending their advertising budget.

5. **Open Port & Vulnerability Scanner (Basic Penetration Test)**
   - **What:** Run a network scan (Nmap equivalent) to see if dangerous ports (like 21 FTP, 22 SSH, 3306 MySQL) are exposed to the public internet on the target IP.
   - **Why:** Adds an advanced "Security Audit" angle that attracts IT professionals and system administrators.

6. **Webhooks Setup**
   - **What:** Allow users to define a Webhook URL in their dashboard. When a Bulk Scan finishes, or a Watched Competitor changes their stack, we automatically `POST` the JSON payload to their server.
   - **Why:** Essential for B2B API integrations.
