/**
 * Contact & Email Finder — deep multi-page extraction.
 * Scans a domain's key pages (/contact, /about, /team, /imprint, etc.)
 * to find emails, phone numbers, social profiles, and key people.
 */

import { fetchPage } from './scraper';
import * as cheerio from 'cheerio';

const CONTACT_PATHS = ['/', '/contact', '/contact-us', '/about', '/about-us', '/team', '/imprint', '/impressum', '/legal', '/support'];
const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(?:\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g;
const JUNK_EMAIL_PATTERNS = [/^.*@example\./, /^.*@sentry\./, /noreply@/, /no-reply@/, /@wixpress\./, /@.*\.png$/, /@.*\.jpg$/, /@.*\.svg$/];

const SOCIAL_PATTERNS: Record<string, RegExp> = {
  twitter: /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)/g,
  linkedin: /https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/([a-zA-Z0-9\-]+)/g,
  facebook: /https?:\/\/(?:www\.)?facebook\.com\/([a-zA-Z0-9.\-]+)/g,
  instagram: /https?:\/\/(?:www\.)?instagram\.com\/([a-zA-Z0-9._]+)/g,
  github: /https?:\/\/(?:www\.)?github\.com\/([a-zA-Z0-9\-]+)/g,
  youtube: /https?:\/\/(?:www\.)?youtube\.com\/(?:@|channel\/|c\/)([a-zA-Z0-9\-_]+)/g,
};

export interface PersonContact {
  name: string;
  role?: string;
  email?: string;
  linkedin?: string;
}

export interface ContactFinderResult {
  domain: string;
  emails: { address: string; source: string; type: 'general' | 'support' | 'sales' | 'personal' | 'other' }[];
  phones: { number: string; source: string }[];
  socialProfiles: Record<string, string[]>;
  people: PersonContact[];
  addresses: string[];
  pagesScanned: number;
  confidence: 'high' | 'medium' | 'low';
}

function classifyEmail(email: string): ContactFinderResult['emails'][0]['type'] {
  const local = email.split('@')[0].toLowerCase();
  if (['info', 'contact', 'hello', 'office', 'general', 'admin'].some(k => local.includes(k))) return 'general';
  if (['support', 'help', 'service', 'customer'].some(k => local.includes(k))) return 'support';
  if (['sales', 'business', 'partnerships', 'enquiries'].some(k => local.includes(k))) return 'sales';
  if (local.includes('.') || local.length > 4) return 'personal';
  return 'other';
}

function isJunkEmail(email: string): boolean {
  return JUNK_EMAIL_PATTERNS.some(p => p.test(email));
}

function extractPeople($: cheerio.CheerioAPI): PersonContact[] {
  const people: PersonContact[] = [];
  const seen = new Set<string>();

  const personSelectors = [
    '.team-member', '.person', '.staff', '.member', '.bio',
    '[itemtype*="Person"]', '.vcard', '.h-card',
    '.about-team .card', '.team .card', '.leadership .card',
  ];

  personSelectors.forEach(selector => {
    $(selector).each((_, el) => {
      const $el = $(el);
      const name = $el.find('h2, h3, h4, .name, .fn, [itemprop="name"]').first().text().trim();
      if (!name || name.length > 80 || seen.has(name)) return;
      seen.add(name);

      const role = $el.find('.role, .title, .position, .job-title, [itemprop="jobTitle"]').first().text().trim() || undefined;
      const email = $el.find('a[href^="mailto:"]').first().attr('href')?.replace('mailto:', '').split('?')[0] || undefined;
      const linkedin = $el.find('a[href*="linkedin.com"]').first().attr('href') || undefined;

      people.push({ name, role, email, linkedin });
    });
  });

  return people;
}

function extractAddresses($: cheerio.CheerioAPI): string[] {
  const addresses: string[] = [];
  $('address, [itemprop="address"], .address, .location').each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (text.length > 10 && text.length < 300) {
      addresses.push(text);
    }
  });
  return [...new Set(addresses)];
}

export async function findContacts(domain: string): Promise<ContactFinderResult> {
  const baseUrl = `https://${domain}`;
  const allEmails = new Map<string, string>();
  const allPhones = new Map<string, string>();
  const allSocial: Record<string, Set<string>> = {};
  let allPeople: PersonContact[] = [];
  let allAddresses: string[] = [];
  let pagesScanned = 0;

  for (const path of CONTACT_PATHS) {
    try {
      const url = `${baseUrl}${path}`;
      const { html, statusCode } = await fetchPage(url);
      if (statusCode >= 400) continue;
      pagesScanned++;

      const $ = cheerio.load(html);
      const bodyText = $('body').text() + ' ' + html;
      const pageName = path === '/' ? 'homepage' : path.replace('/', '');

      // Emails
      const hrefEmails = $('a[href^="mailto:"]').map((_, el) => $(el).attr('href')?.replace('mailto:', '').split('?')[0] || '').get();
      const textEmails = bodyText.match(EMAIL_REGEX) || [];
      [...hrefEmails, ...textEmails]
        .filter(e => e && !isJunkEmail(e) && e.length < 60)
        .forEach(e => { if (!allEmails.has(e.toLowerCase())) allEmails.set(e.toLowerCase(), pageName); });

      // Phones
      const hrefPhones = $('a[href^="tel:"]').map((_, el) => $(el).attr('href')?.replace('tel:', '') || '').get();
      const textPhones = bodyText.match(PHONE_REGEX) || [];
      [...hrefPhones, ...textPhones.map(p => p.trim())]
        .filter(p => p.length >= 7 && p.length <= 20)
        .forEach(p => { if (!allPhones.has(p)) allPhones.set(p, pageName); });

      // Social profiles
      Object.entries(SOCIAL_PATTERNS).forEach(([platform, regex]) => {
        const matches = bodyText.matchAll(new RegExp(regex));
        for (const m of matches) {
          if (!allSocial[platform]) allSocial[platform] = new Set();
          allSocial[platform].add(m[0]);
        }
      });

      // People
      allPeople = [...allPeople, ...extractPeople($)];

      // Addresses
      allAddresses = [...allAddresses, ...extractAddresses($)];
    } catch {
      continue;
    }
  }

  const emails = [...allEmails.entries()].map(([address, source]) => ({
    address, source, type: classifyEmail(address),
  }));

  const phones = [...allPhones.entries()].map(([number, source]) => ({ number, source }));

  const socialProfiles: Record<string, string[]> = {};
  Object.entries(allSocial).forEach(([platform, urls]) => {
    socialProfiles[platform] = [...urls];
  });

  // Deduplicate people
  const peopleMap = new Map<string, PersonContact>();
  allPeople.forEach(p => { if (!peopleMap.has(p.name)) peopleMap.set(p.name, p); });

  const confidence: ContactFinderResult['confidence'] =
    emails.length >= 2 && (phones.length > 0 || Object.keys(socialProfiles).length >= 2) ? 'high' :
    emails.length >= 1 ? 'medium' : 'low';

  return {
    domain,
    emails: emails.slice(0, 20),
    phones: phones.slice(0, 10),
    socialProfiles,
    people: [...peopleMap.values()].slice(0, 15),
    addresses: [...new Set(allAddresses)].slice(0, 5),
    pagesScanned,
    confidence,
  };
}
