/**
 * Change Detection Engine — checks monitored domains for tech stack changes,
 * security regressions, performance shifts, and SSL expiry warnings.
 * Creates notifications and delivers webhooks when changes are detected.
 */

import { getDomainsToCheck, updateMonitorCheck, createNotification, saveScan, getLastScan } from '../db/client';
import { checkUptime } from './uptime';

const SCAN_TIMEOUT_MS = 12000;

async function quickScan(domain: string): Promise<any> {
  try {
    const { exec } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const { join } = await import('node:path');
    const execAsync = promisify(exec);

    const scraperPath = join(process.cwd(), 'src/utils/wappalyzer-scraper.cjs');
    const { stdout } = await execAsync(`node "${scraperPath}" "https://${domain}"`, { timeout: SCAN_TIMEOUT_MS });
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

function diffTechStacks(oldTechs: string[], newTechs: string[]): { added: string[]; removed: string[] } {
  const oldSet = new Set(oldTechs);
  const newSet = new Set(newTechs);
  return {
    added: newTechs.filter(t => !oldSet.has(t)),
    removed: oldTechs.filter(t => !newSet.has(t)),
  };
}

async function deliverWebhook(webhookUrl: string, payload: any) {
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'SiteIntelica Webhook/1.0' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
  } catch { }
}

export async function runChangeDetection(): Promise<{ checked: number; changes: number }> {
  const domains = getDomainsToCheck();
  let checked = 0;
  let changes = 0;

  for (const monitor of domains) {
    try {
      // Run uptime check
      const uptimeResult = await checkUptime(monitor.domain);

      // SSL expiry warning
      if (uptimeResult.sslDaysLeft !== null && uptimeResult.sslDaysLeft <= 14) {
        createNotification(
          monitor.user_id,
          'ssl_expiry',
          `⚠️ SSL expiring: ${monitor.domain}`,
          `Certificate expires in ${uptimeResult.sslDaysLeft} day${uptimeResult.sslDaysLeft !== 1 ? 's' : ''}. Renew immediately to avoid security warnings.`,
          monitor.domain
        );
        changes++;
      }

      // Downtime alert
      if (!uptimeResult.isUp) {
        createNotification(
          monitor.user_id,
          'security',
          `🔴 ${monitor.domain} is DOWN`,
          `HTTP check returned ${uptimeResult.statusCode || 'connection error'}. ${uptimeResult.error || ''}`,
          monitor.domain
        );
        changes++;
      }

      // Tech stack scan
      const newScan = await quickScan(monitor.domain);
      if (newScan && !newScan.error) {
        const previousScan = getLastScan(monitor.domain);
        saveScan(monitor.domain, newScan, monitor.user_id);

        if (previousScan?.data?.technologies && newScan.technologies) {
          const oldTechs = previousScan.data.technologies.map((t: any) => t.name);
          const newTechs = newScan.technologies.map((t: any) => t.name);
          const diff = diffTechStacks(oldTechs, newTechs);

          if (diff.added.length > 0 || diff.removed.length > 0) {
            const parts: string[] = [];
            if (diff.added.length > 0) parts.push(`Added: ${diff.added.join(', ')}`);
            if (diff.removed.length > 0) parts.push(`Removed: ${diff.removed.join(', ')}`);

            createNotification(
              monitor.user_id,
              'tech_change',
              `🔄 Tech stack changed: ${monitor.domain}`,
              parts.join(' | '),
              monitor.domain,
              { added: diff.added, removed: diff.removed }
            );
            changes++;

            if (monitor.webhook_url) {
              await deliverWebhook(monitor.webhook_url, {
                event: 'tech_change',
                domain: monitor.domain,
                added: diff.added,
                removed: diff.removed,
                timestamp: new Date().toISOString(),
              });
            }
          }
        }
      }

      updateMonitorCheck(monitor.id);
      checked++;

      // Small delay between domains to be polite
      await new Promise(r => setTimeout(r, 500));
    } catch (e) {
      console.error(`Change detection error for ${monitor.domain}:`, e);
    }
  }

  return { checked, changes };
}
