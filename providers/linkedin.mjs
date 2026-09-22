// @ts-check
/** @typedef {import('./_types.js').Provider} Provider */

import { scrapeJobs } from 'ts-jobspy';

const LINKEDIN_JOBS_URL = 'https://www.linkedin.com/jobs/';
const LINKEDIN_HOSTS = new Set(['linkedin.com', 'www.linkedin.com']);
const MAX_SEARCHES = 8;
const MAX_RESULTS_PER_SEARCH = 50;

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanLinkedInJobUrl(value) {
  try {
    const url = new URL(String(value || ''));
    if (url.protocol !== 'https:' || !LINKEDIN_HOSTS.has(url.hostname.toLowerCase())) return '';
    if (!/^\/jobs\/view\/\d+\/?$/i.test(url.pathname)) return '';
    url.hostname = 'www.linkedin.com';
    url.search = '';
    url.hash = '';
    url.pathname = url.pathname.replace(/\/$/, '');
    return url.href;
  } catch {
    return '';
  }
}

function parsePostedAt(value) {
  const raw = cleanString(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined;
  const timestamp = Date.parse(`${raw}T00:00:00Z`);
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

function normalizeSalary(job) {
  const rawMin = job?.minAmount;
  const rawMax = job?.maxAmount;
  const min = rawMin === null || rawMin === undefined || rawMin === '' ? NaN : Number(rawMin);
  const max = rawMax === null || rawMax === undefined || rawMax === '' ? NaN : Number(rawMax);
  if (!Number.isFinite(min) && !Number.isFinite(max)) return undefined;
  const salary = {};
  if (Number.isFinite(min)) salary.min = min;
  if (Number.isFinite(max)) salary.max = max;
  const currency = cleanString(job?.currency).toUpperCase();
  if (currency) salary.currency = currency;
  return salary;
}

/** Normalize a ts-jobspy LinkedIn row into the career-ops provider contract. */
export function normalizeLinkedInJob(job) {
  if (!job || typeof job !== 'object') return null;
  const title = cleanString(job.title);
  const url = cleanLinkedInJobUrl(job.jobUrl);
  if (!title || !url) return null;

  /** @type {any} */
  const normalized = {
    title,
    url,
    company: cleanString(job.company) || 'Unknown',
    location: cleanString(job.location),
  };
  const postedAt = parsePostedAt(job.datePosted);
  if (postedAt !== undefined) normalized.postedAt = postedAt;
  const description = cleanString(job.description);
  if (description) normalized.description = description;
  const salary = normalizeSalary(job);
  if (salary) normalized.salary = salary;
  return normalized;
}

function searchesFor(entry, probe) {
  const configured = Array.isArray(entry.searches) ? entry.searches : [];
  const searches = configured
    .slice(0, MAX_SEARCHES)
    .map(item => ({ term: cleanString(item?.term), location: cleanString(item?.location) }))
    .filter(item => item.term && item.location);
  if (searches.length === 0) {
    throw new Error('linkedin: configure at least one searches[] entry with term and location');
  }
  return probe ? searches.slice(0, 1) : searches;
}

/** @type {Provider} */
export default {
  id: 'linkedin',

  detect(entry) {
    return entry?.provider === 'linkedin' ? { url: LINKEDIN_JOBS_URL } : null;
  },

  async fetch(entry, ctx) {
    const probe = Number(ctx?.maxPages || 0) === 1;
    const requested = Math.max(1, Math.min(
      probe ? 5 : MAX_RESULTS_PER_SEARCH,
      Number(entry.results_per_search) || 25,
    ));
    const hoursOld = Math.max(1, Math.min(24 * 30, Number(entry.hours_old) || 24 * 30));
    const fetchDescription = !probe && entry.fetch_descriptions === true;
    const searches = searchesFor(entry, probe);
    const jobs = [];
    const seen = new Set();

    for (const search of searches) {
      const result = await scrapeJobs({
        sites: ['linkedin'],
        searchTerm: search.term,
        location: search.location,
        resultsWanted: fetchDescription ? Math.min(requested, 10) : requested,
        hoursOld,
        linkedin: { fetchDescription },
        strict: false,
        timeoutMs: probe ? 30_000 : 45_000,
        siteConcurrency: 1,
        verbose: 0,
      });

      const meta = result.meta?.sites?.find(site => site.site === 'linkedin');
      if (meta?.status === 'error') {
        throw new Error(`linkedin: ${meta.error?.message || 'search failed'}`);
      }
      if (meta?.status === 'partial') {
        console.warn(`⚠️  LinkedIn partial result for ${search.term} @ ${search.location}: ${meta.error?.message || 'interrupted'}`);
      }

      for (const rawJob of result.jobs || []) {
        const job = normalizeLinkedInJob(rawJob);
        if (!job || seen.has(job.url)) continue;
        seen.add(job.url);
        jobs.push(job);
      }
    }

    return jobs;
  },
};
