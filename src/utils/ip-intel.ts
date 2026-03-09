/**
 * IP-to-ASN / Cloud Provider detection.
 * Uses the free ip-api.com service to map an IP address to its ASN owner,
 * then classifies it into a cloud provider tier for hosting cost refinement.
 */

const IP_API_URL = 'http://ip-api.com/json';
const FETCH_TIMEOUT = 5000;

const CLOUD_PROVIDERS: Record<string, { name: string; tier: string; costMultiplier: number }> = {
  'amazon': { name: 'Amazon Web Services', tier: 'Enterprise Cloud', costMultiplier: 1.0 },
  'aws': { name: 'Amazon Web Services', tier: 'Enterprise Cloud', costMultiplier: 1.0 },
  'google': { name: 'Google Cloud Platform', tier: 'Enterprise Cloud', costMultiplier: 0.9 },
  'microsoft': { name: 'Microsoft Azure', tier: 'Enterprise Cloud', costMultiplier: 1.0 },
  'azure': { name: 'Microsoft Azure', tier: 'Enterprise Cloud', costMultiplier: 1.0 },
  'cloudflare': { name: 'Cloudflare', tier: 'CDN / Edge', costMultiplier: 0.3 },
  'fastly': { name: 'Fastly', tier: 'CDN / Edge', costMultiplier: 0.5 },
  'akamai': { name: 'Akamai', tier: 'Enterprise CDN', costMultiplier: 1.5 },
  'digitalocean': { name: 'DigitalOcean', tier: 'Cloud VPS', costMultiplier: 0.4 },
  'linode': { name: 'Linode (Akamai)', tier: 'Cloud VPS', costMultiplier: 0.4 },
  'vultr': { name: 'Vultr', tier: 'Cloud VPS', costMultiplier: 0.35 },
  'hetzner': { name: 'Hetzner', tier: 'Budget Cloud', costMultiplier: 0.2 },
  'ovh': { name: 'OVHcloud', tier: 'Budget Cloud', costMultiplier: 0.25 },
  'vercel': { name: 'Vercel', tier: 'Serverless', costMultiplier: 0.15 },
  'netlify': { name: 'Netlify', tier: 'Serverless', costMultiplier: 0.15 },
  'heroku': { name: 'Heroku', tier: 'PaaS', costMultiplier: 0.6 },
  'rackspace': { name: 'Rackspace', tier: 'Managed Cloud', costMultiplier: 1.2 },
  'godaddy': { name: 'GoDaddy', tier: 'Shared Hosting', costMultiplier: 0.1 },
  'bluehost': { name: 'Bluehost', tier: 'Shared Hosting', costMultiplier: 0.1 },
  'hostgator': { name: 'HostGator', tier: 'Shared Hosting', costMultiplier: 0.1 },
  'wpengine': { name: 'WP Engine', tier: 'Managed WordPress', costMultiplier: 0.5 },
  'shopify': { name: 'Shopify', tier: 'E-commerce Platform', costMultiplier: 0.4 },
  'squarespace': { name: 'Squarespace', tier: 'Website Builder', costMultiplier: 0.15 },
  'wix': { name: 'Wix', tier: 'Website Builder', costMultiplier: 0.15 },
  'oracle': { name: 'Oracle Cloud', tier: 'Enterprise Cloud', costMultiplier: 0.8 },
  'alibaba': { name: 'Alibaba Cloud', tier: 'Enterprise Cloud', costMultiplier: 0.7 },
};

export interface IpIntel {
  ip: string;
  isp: string;
  org: string;
  as: string;
  asName: string;
  country: string;
  region: string;
  city: string;
  cloudProvider: { name: string; tier: string; costMultiplier: number } | null;
}

export async function getIpIntel(ip: string): Promise<IpIntel | null> {
  if (!ip) return null;

  try {
    const res = await fetch(`${IP_API_URL}/${ip}?fields=status,isp,org,as,asname,country,regionName,city`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (data.status !== 'success') return null;

    const orgLower = `${data.isp} ${data.org} ${data.asname} ${data.as}`.toLowerCase();
    let cloudProvider: IpIntel['cloudProvider'] = null;

    for (const [keyword, provider] of Object.entries(CLOUD_PROVIDERS)) {
      if (orgLower.includes(keyword)) {
        cloudProvider = provider;
        break;
      }
    }

    return {
      ip,
      isp: data.isp || '',
      org: data.org || '',
      as: data.as || '',
      asName: data.asname || '',
      country: data.country || '',
      region: data.regionName || '',
      city: data.city || '',
      cloudProvider,
    };
  } catch {
    return null;
  }
}
