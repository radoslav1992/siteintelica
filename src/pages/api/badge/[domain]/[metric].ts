import type { APIRoute } from 'astro';
import { getPublicReport } from '../../../../db/client';
import { calculateSecurityGrade } from '../../../../utils/security-grade';

export const prerender = false;

const BADGE_WIDTH = 200;
const BADGE_HEIGHT = 20;

function generateSVG(label: string, value: string, color: string): string {
  const labelWidth = label.length * 6.5 + 12;
  const valueWidth = value.length * 6.5 + 12;
  const totalWidth = labelWidth + valueWidth;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${BADGE_HEIGHT}" role="img" aria-label="${label}: ${value}">
  <title>${label}: ${value}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r"><rect width="${totalWidth}" height="${BADGE_HEIGHT}" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="${BADGE_HEIGHT}" fill="#555"/>
    <rect x="${labelWidth}" width="${valueWidth}" height="${BADGE_HEIGHT}" fill="${color}"/>
    <rect width="${totalWidth}" height="${BADGE_HEIGHT}" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="11">
    <text x="${labelWidth / 2}" y="14">${label}</text>
    <text x="${labelWidth + valueWidth / 2}" y="14">${value}</text>
  </g>
</svg>`;
}

export const GET: APIRoute = async ({ params }) => {
  const { domain, metric } = params;

  if (!domain || !metric) {
    return new Response('Missing parameters', { status: 400 });
  }

  const report = getPublicReport(domain);
  if (!report) {
    const svg = generateSVG('SiteIntelica', 'not scanned', '#9f9f9f');
    return new Response(svg, {
      headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=3600' },
    });
  }

  const data = report.data;
  let label = 'SiteIntelica';
  let value = 'unknown';
  let color = '#9f9f9f';

  switch (metric) {
    case 'security': {
      const grade = calculateSecurityGrade(data.security);
      label = 'Security';
      value = `${grade.grade} (${grade.score}/100)`;
      color = grade.score >= 75 ? '#4c1' : grade.score >= 45 ? '#dfb317' : '#e05d44';
      break;
    }
    case 'performance': {
      const score = data.performance?.score;
      label = 'Performance';
      value = score != null ? `${score}/100` : 'N/A';
      color = score >= 80 ? '#4c1' : score >= 50 ? '#dfb317' : '#e05d44';
      break;
    }
    case 'seo': {
      const score = data.performance?.seo;
      label = 'SEO';
      value = score != null ? `${score}/100` : 'N/A';
      color = score >= 80 ? '#4c1' : score >= 50 ? '#dfb317' : '#e05d44';
      break;
    }
    case 'tech-count': {
      const count = (data.technologies || []).length;
      label = 'Technologies';
      value = `${count} detected`;
      color = '#007ec6';
      break;
    }
    default:
      value = 'invalid metric';
  }

  const svg = generateSVG(label, value, color);
  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
