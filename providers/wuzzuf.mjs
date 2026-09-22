import { decodeEntities } from './_html-entities.mjs';
import { fetchTextWithRetry } from './_http.mjs';

// WUZZUF provider — public, no-auth job-list index.
//
// WUZZUF's interactive /search/jobs pages sit behind Cloudflare and reject
// ordinary HTTP clients. Its own public sitemap index is intentionally served
// to crawlers and contains the current job inventory with direct job URLs,
// titles, companies, and locations. Reading that one index is both more stable
// and substantially gentler than walking hundreds of protected search pages.

const JOB_LIST_URL = 'https://wuzzuf.net/sitemap-updates/job-list';
const TRUSTED_HOSTS = new Set(['wuzzuf.net', 'www.wuzzuf.net']);

function cleanText(value) {
  return decodeEntities(String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
}

function cleanJobUrl(value) {
  try {
    const url = new URL(decodeEntities(String(value || '')), JOB_LIST_URL);
    if (url.protocol !== 'https:' || !TRUSTED_HOSTS.has(url.hostname.toLowerCase())) return '';
    if (!/^\/(?:jobs\/p(?:\/g)?|internship)\//.test(url.pathname)) return '';
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (/^(?:utm_|ref$|source$)/i.test(key)) url.searchParams.delete(key);
    }
    return url.href;
  } catch {
    return '';
  }
}

function slugWords(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function recoverTruncatedTitle(title, company, url) {
  if (!/(?:\.\.\.|…)$/.test(title)) return title;
  try {
    const slug = new URL(url).pathname.split('/').filter(Boolean).at(-1) || '';
    const withoutId = slug.replace(/^[a-z0-9]+-/, '');
    const companySlug = slugWords(company);
    const marker = companySlug ? `-${companySlug}-` : '';
    const boundary = marker ? withoutId.lastIndexOf(marker) : -1;
    if (boundary < 1) return title;
    return withoutId
      .slice(0, boundary)
      .split('-')
      .filter(Boolean)
      .map((word) => word.length <= 3 && /^(?:ai|bi|hr|it|b2b|b2c|qa|ui|ux)$/i.test(word)
        ? word.toUpperCase()
        : word[0].toUpperCase() + word.slice(1))
      .join(' ');
  } catch {
    return title;
  }
}

// Sitemap labels use: "{title} at {company} in {location}". Split from the
// right so a title containing "at" or "in" does not corrupt the common case.
function parseLabel(value) {
  const text = cleanText(value).replace(/^[-–—]\s*/, '');
  const inAt = text.lastIndexOf(' in ');
  const beforeLocation = inAt >= 0 ? text.slice(0, inAt) : text;
  const atAt = beforeLocation.lastIndexOf(' at ');
  if (atAt < 1) return { title: text, company: 'Unknown', location: inAt >= 0 ? text.slice(inAt + 4) : '' };
  return {
    title: beforeLocation.slice(0, atAt).trim(),
    company: beforeLocation.slice(atAt + 4).trim() || 'Unknown',
    location: inAt >= 0 ? text.slice(inAt + 4).trim() : '',
  };
}

/** Parse WUZZUF's public `/sitemap-updates/job-list` page. */
export function parseWuzzufJobList(html) {
  if (typeof html !== 'string' || !html.trim()) return [];
  if (/captcha|verify you are human|access denied|just a moment|cloudflare/i.test(html)
      && !/\/(?:jobs\/p(?:\/g)?|internship)\//i.test(html)) {
    throw new Error('wuzzuf: access blocked by an anti-bot page');
  }

  const anchor = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const jobs = [];
  const seen = new Set();
  for (const match of html.matchAll(anchor)) {
    const url = cleanJobUrl(match[1]);
    if (!url || seen.has(url)) continue;
    const parsed = parseLabel(match[2]);
    const title = recoverTruncatedTitle(parsed.title, parsed.company, url);
    const { company, location } = parsed;
    if (!title) continue;
    seen.add(url);
    jobs.push({ title, company, location, url });
  }

  // Fail loudly on a recognizable index whose markup changed. Returning []
  // here would make a broken parser look like a healthy board with no jobs.
  if (jobs.length === 0 && /all jobs|most recent jobs|job-list/i.test(cleanText(html))) {
    throw new Error('wuzzuf: job-list page shape changed; no job links could be parsed');
  }
  return jobs;
}

export default {
  id: 'wuzzuf',

  detect(entry) {
    return entry?.provider === 'wuzzuf' ? { url: JOB_LIST_URL } : null;
  },

  async fetch(_entry, ctx) {
    const html = await fetchTextWithRetry(ctx, JOB_LIST_URL, {
      redirect: 'error',
      timeoutMs: 30_000,
      headers: {
        'user-agent': 'career-ops/1.0 (+https://career-ops.org)',
        accept: 'text/html,application/xhtml+xml',
      },
    }, { retries: 1, baseDelayMs: 750, maxDelayMs: 2_000 });
    return parseWuzzufJobList(html);
  },
};
