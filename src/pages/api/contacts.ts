import type { APIRoute } from 'astro';
import { findContacts } from '../../utils/contact-finder';
import { logAudit } from '../../db/client';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized. Premium feature.' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const { domain } = await context.request.json();
    if (!domain) {
      return new Response(JSON.stringify({ error: 'domain is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '').split('/')[0];
    const result = await findContacts(cleanDomain);
    logAudit(user.id, 'contact_find', cleanDomain, { emailsFound: result.emails.length, confidence: result.confidence });

    return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: 'Contact finder failed: ' + error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
