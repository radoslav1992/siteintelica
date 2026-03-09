import { promises as dns } from 'node:dns';

// Lightweight list of most common subdomains for discovery
const COMMON_SUBDOMAINS = [
    'www', 'mail', 'remote', 'blog', 'webmail', 'server', 'ns1', 'ns2', 'smtp',
    'secure', 'vpn', 'api', 'dev', 'staging', 'test', 'admin', 'portal', 'erp',
    'crm', 'app', 'cdn', 'shop', 'store', 'support', 'help', 'docs', 'status'
];

export async function enumerateSubdomains(domain: string): Promise<string[]> {
    const found: string[] = [];

    // Strip www. if provided
    const baseDomain = domain.replace(/^www\./, '');

    // Run checks concurrently but with a reasonable limit to avoid overwhelming DNS
    const chunkSize = 10;
    for (let i = 0; i < COMMON_SUBDOMAINS.length; i += chunkSize) {
        const chunk = COMMON_SUBDOMAINS.slice(i, i + chunkSize);
        const promises = chunk.map(async (sub) => {
            const target = `${sub}.${baseDomain}`;
            try {
                await dns.lookup(target);
                found.push(target);
            } catch (err) {
                // ENOTFOUND means it doesn't exist
            }
        });

        await Promise.allSettled(promises);
    }

    return found;
}
