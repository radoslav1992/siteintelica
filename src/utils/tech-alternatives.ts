/**
 * Technology Alternatives Advisor — for each detected technology, suggest modern
 * replacements with migration difficulty, cost comparison, and reasoning.
 * This is a major differentiator from free tools.
 */

interface Alternative {
  name: string;
  reason: string;
  migrationDifficulty: 'easy' | 'moderate' | 'hard' | 'major';
  costChange: 'cheaper' | 'similar' | 'more expensive' | 'free';
}

interface TechAdvisory {
  technology: string;
  status: 'current' | 'outdated' | 'end-of-life' | 'consider-alternatives';
  message: string;
  alternatives: Alternative[];
}

const ADVISORIES: Record<string, Omit<TechAdvisory, 'technology'>> = {
  'jQuery': {
    status: 'outdated',
    message: 'jQuery was essential in the IE era but modern browsers have native equivalents. Removing it saves 30-90KB and improves performance.',
    alternatives: [
      { name: 'Vanilla JavaScript', reason: 'Modern JS has querySelector, fetch, classList — everything jQuery provided', migrationDifficulty: 'moderate', costChange: 'free' },
      { name: 'Alpine.js', reason: 'Lightweight (15KB) reactive framework for simple interactivity', migrationDifficulty: 'easy', costChange: 'free' },
      { name: 'htmx', reason: 'Server-driven interactivity without writing JavaScript', migrationDifficulty: 'moderate', costChange: 'free' },
    ],
  },
  'AngularJS': {
    status: 'end-of-life',
    message: 'AngularJS reached end-of-life in December 2021. No security patches are being released. Migration is urgent.',
    alternatives: [
      { name: 'Angular 17+', reason: 'Official successor with migration tools available', migrationDifficulty: 'hard', costChange: 'free' },
      { name: 'React', reason: 'Largest ecosystem, most job market demand', migrationDifficulty: 'major', costChange: 'free' },
      { name: 'Vue.js', reason: 'Gentler learning curve, similar template syntax to AngularJS', migrationDifficulty: 'hard', costChange: 'free' },
    ],
  },
  'WordPress': {
    status: 'consider-alternatives',
    message: 'WordPress powers 40% of the web but is a frequent target for attacks and can be slow without optimization. Consider headless or static alternatives for performance-critical sites.',
    alternatives: [
      { name: 'WordPress + Headless', reason: 'Keep WP as CMS backend, serve via Next.js/Astro for speed', migrationDifficulty: 'moderate', costChange: 'similar' },
      { name: 'Ghost', reason: 'Modern publishing platform, faster and more secure by default', migrationDifficulty: 'moderate', costChange: 'similar' },
      { name: 'Webflow', reason: 'Visual builder with hosting, no server maintenance', migrationDifficulty: 'hard', costChange: 'more expensive' },
    ],
  },
  'Wix': {
    status: 'consider-alternatives',
    message: 'Wix is easy to start with but has performance limitations and vendor lock-in. Consider alternatives if you need speed or flexibility.',
    alternatives: [
      { name: 'Webflow', reason: 'More design flexibility, better performance, exportable code', migrationDifficulty: 'moderate', costChange: 'similar' },
      { name: 'WordPress + Elementor', reason: 'Full ownership, larger plugin ecosystem', migrationDifficulty: 'moderate', costChange: 'similar' },
      { name: 'Framer', reason: 'Modern design tool with hosting, great for marketing sites', migrationDifficulty: 'moderate', costChange: 'similar' },
    ],
  },
  'Squarespace': {
    status: 'current',
    message: 'Squarespace is good for small business sites but limited in customization and performance tuning.',
    alternatives: [
      { name: 'Webflow', reason: 'More design control with similar ease of use', migrationDifficulty: 'moderate', costChange: 'similar' },
      { name: 'Shopify', reason: 'Better if you need serious e-commerce capabilities', migrationDifficulty: 'moderate', costChange: 'similar' },
    ],
  },
  'React': {
    status: 'current',
    message: 'React is the industry standard. If you\'re on an older version (< 18), upgrade for automatic batching and concurrent features.',
    alternatives: [
      { name: 'Next.js', reason: 'React metaframework with SSR, routing, and optimization built in', migrationDifficulty: 'easy', costChange: 'free' },
      { name: 'Remix', reason: 'Full-stack React with progressive enhancement', migrationDifficulty: 'moderate', costChange: 'free' },
    ],
  },
  'Vue.js': {
    status: 'current',
    message: 'Vue 3 with Composition API is the current standard. If still on Vue 2, migrate soon — Vue 2 reached EOL Dec 2023.',
    alternatives: [
      { name: 'Nuxt 3', reason: 'Vue metaframework with SSR, file-based routing, and auto-imports', migrationDifficulty: 'easy', costChange: 'free' },
    ],
  },
  'Moment.js': {
    status: 'outdated',
    message: 'Moment.js is in maintenance mode and adds 67KB+ to your bundle. Modern alternatives are 2-15KB.',
    alternatives: [
      { name: 'date-fns', reason: 'Tree-shakeable, only import what you use (2-10KB typical)', migrationDifficulty: 'easy', costChange: 'free' },
      { name: 'Day.js', reason: 'Drop-in Moment.js replacement at just 2KB', migrationDifficulty: 'easy', costChange: 'free' },
      { name: 'Temporal API', reason: 'Native browser API (in progress) — zero bundle cost', migrationDifficulty: 'moderate', costChange: 'free' },
    ],
  },
  'Lodash': {
    status: 'consider-alternatives',
    message: 'Lodash adds 70KB to your bundle. Most functions now have native JS equivalents. Import individual functions if you must keep it.',
    alternatives: [
      { name: 'Native JavaScript', reason: 'ES2023+ has map, filter, reduce, Object.entries, structuredClone, Array.at, etc.', migrationDifficulty: 'easy', costChange: 'free' },
      { name: 'Radash', reason: 'Modern Lodash alternative, tree-shakeable, TypeScript-first', migrationDifficulty: 'easy', costChange: 'free' },
    ],
  },
  'Google Analytics': {
    status: 'consider-alternatives',
    message: 'GA4 works but raises GDPR concerns in the EU (several countries have ruled it non-compliant). Consider privacy-first alternatives.',
    alternatives: [
      { name: 'Plausible', reason: 'GDPR-compliant, no cookie consent needed, lighter script (< 1KB)', migrationDifficulty: 'easy', costChange: 'more expensive' },
      { name: 'Fathom', reason: 'Privacy-first, EU-hosted option, simple dashboard', migrationDifficulty: 'easy', costChange: 'more expensive' },
      { name: 'Umami', reason: 'Open-source, self-hosted, GDPR-compliant, free', migrationDifficulty: 'easy', costChange: 'free' },
    ],
  },
  'Bootstrap': {
    status: 'current',
    message: 'Bootstrap is reliable but adds significant CSS weight. Consider lighter alternatives if you only need a grid and basic components.',
    alternatives: [
      { name: 'Tailwind CSS', reason: 'Utility-first, only ships CSS you actually use', migrationDifficulty: 'hard', costChange: 'free' },
      { name: 'Open Props', reason: 'CSS custom properties for consistent design tokens, zero runtime', migrationDifficulty: 'moderate', costChange: 'free' },
    ],
  },
  'Shopify': {
    status: 'current',
    message: 'Shopify is the gold standard for e-commerce. Consider Shopify Plus if you\'re hitting $1M+ in annual revenue.',
    alternatives: [
      { name: 'Shopify Hydrogen', reason: 'Headless Shopify with React — better performance for high-traffic stores', migrationDifficulty: 'hard', costChange: 'similar' },
    ],
  },
  'WooCommerce': {
    status: 'current',
    message: 'WooCommerce is flexible but requires more maintenance than hosted solutions. Performance degrades with many plugins.',
    alternatives: [
      { name: 'Shopify', reason: 'Fully hosted, better security, less maintenance', migrationDifficulty: 'hard', costChange: 'more expensive' },
      { name: 'Medusa.js', reason: 'Open-source headless commerce, modern Node.js stack', migrationDifficulty: 'major', costChange: 'cheaper' },
    ],
  },
  'Mailchimp': {
    status: 'current',
    message: 'Mailchimp is popular but expensive at scale and limited in automation compared to newer platforms.',
    alternatives: [
      { name: 'ConvertKit', reason: 'Better for creators, visual automation builder, fairer pricing', migrationDifficulty: 'easy', costChange: 'similar' },
      { name: 'Resend', reason: 'Developer-first transactional email with modern API', migrationDifficulty: 'easy', costChange: 'cheaper' },
      { name: 'Loops', reason: 'Modern email for SaaS — event-based automation', migrationDifficulty: 'moderate', costChange: 'similar' },
    ],
  },
  'Hotjar': {
    status: 'consider-alternatives',
    message: 'Hotjar records user sessions which raises significant privacy concerns. Lighter alternatives exist for heatmaps.',
    alternatives: [
      { name: 'PostHog', reason: 'Open-source session recording + product analytics, self-hostable', migrationDifficulty: 'easy', costChange: 'cheaper' },
      { name: 'Clarity', reason: 'Microsoft\'s free session recording — similar features, no cost', migrationDifficulty: 'easy', costChange: 'free' },
    ],
  },
  'Zendesk': {
    status: 'current',
    message: 'Zendesk is enterprise-grade but expensive and complex for small teams.',
    alternatives: [
      { name: 'Intercom', reason: 'More modern UX, better for product-led companies', migrationDifficulty: 'moderate', costChange: 'similar' },
      { name: 'Crisp', reason: 'Simpler, cheaper, includes chatbot and shared inbox', migrationDifficulty: 'easy', costChange: 'cheaper' },
    ],
  },
  'Heroku': {
    status: 'outdated',
    message: 'Heroku removed its free tier in 2022 and has stagnated in features. Modern alternatives offer better value.',
    alternatives: [
      { name: 'Railway', reason: 'Modern Heroku replacement with better pricing and DX', migrationDifficulty: 'easy', costChange: 'cheaper' },
      { name: 'Fly.io', reason: 'Edge deployment, Docker-native, generous free tier', migrationDifficulty: 'moderate', costChange: 'cheaper' },
      { name: 'Render', reason: 'Simple deployment with free static hosting and PostgreSQL', migrationDifficulty: 'easy', costChange: 'cheaper' },
    ],
  },
};

export function getAdvisories(technologies: { name: string; version?: string; categories?: any[] }[]): TechAdvisory[] {
  const advisories: TechAdvisory[] = [];

  technologies.forEach(tech => {
    const advisory = ADVISORIES[tech.name];
    if (advisory) {
      advisories.push({ technology: tech.name, ...advisory });
    }
  });

  const STATUS_ORDER: Record<string, number> = { 'end-of-life': 0, 'outdated': 1, 'consider-alternatives': 2, 'current': 3 };
  return advisories.sort((a, b) => (STATUS_ORDER[a.status] ?? 4) - (STATUS_ORDER[b.status] ?? 4));
}

export function getStackRecommendations(technologies: { name: string }[]): string[] {
  const techNames = new Set(technologies.map(t => t.name));
  const recommendations: string[] = [];

  if (!techNames.has('Cloudflare') && !techNames.has('Fastly') && !techNames.has('Amazon CloudFront')) {
    recommendations.push('Add a CDN (Cloudflare free tier is excellent) — reduces latency by 40-60% globally');
  }

  const hasAnalytics = techNames.has('Google Analytics') || techNames.has('Mixpanel') || techNames.has('Amplitude') || techNames.has('Plausible') || techNames.has('Fathom');
  if (!hasAnalytics) {
    recommendations.push('Add analytics to understand your visitors — Plausible or Umami for privacy-first options');
  }

  const hasErrorTracking = techNames.has('Sentry') || techNames.has('Datadog') || techNames.has('New Relic') || techNames.has('LogRocket');
  if (!hasErrorTracking && technologies.length > 8) {
    recommendations.push('Add error tracking (Sentry has a free tier) — catch bugs before your users report them');
  }

  const hasSearch = techNames.has('Algolia') || techNames.has('Elasticsearch') || techNames.has('MeiliSearch') || techNames.has('Typesense');
  if (!hasSearch && technologies.length > 12) {
    recommendations.push('Consider adding site search (Algolia or self-hosted MeiliSearch) for better user navigation');
  }

  if (techNames.has('jQuery') && techNames.has('React')) {
    recommendations.push('You\'re loading both jQuery and React — remove jQuery to save 30KB+ and reduce complexity');
  }

  if (techNames.has('Moment.js')) {
    recommendations.push('Replace Moment.js with Day.js (2KB vs 67KB) — it\'s a drop-in replacement');
  }

  return recommendations;
}
