import assert from 'node:assert/strict';
import test from 'node:test';
import provider, { parseWuzzufJobList } from '../../providers/wuzzuf.mjs';

const row = (id, label, path = 'jobs/p') =>
  `<li><a href="https://wuzzuf.net/${path}/${id}-role">- ${label}</a></li>`;

test('parses the public job-list index into normalized jobs', () => {
  const jobs = parseWuzzufJobList(`<h1>All Jobs</h1>
    ${row('abc', 'Head of Strategy &amp; Execution at WUZZUF in Cairo, Egypt')}
    ${row('def', 'Commercial Strategy Manager at Acme Group in Dubai, United Arab Emirates')}`);
  assert.deepEqual(jobs, [
    {
      title: 'Head of Strategy & Execution',
      company: 'WUZZUF',
      location: 'Cairo, Egypt',
      url: 'https://wuzzuf.net/jobs/p/abc-role',
    },
    {
      title: 'Commercial Strategy Manager',
      company: 'Acme Group',
      location: 'Dubai, United Arab Emirates',
      url: 'https://wuzzuf.net/jobs/p/def-role',
    },
  ]);
});

test('supports internship links and title text containing at/in', () => {
  const jobs = parseWuzzufJobList(row('int1', 'Operations at Scale in MENA Lead at Example Co in Giza, Egypt', 'internship'));
  assert.equal(jobs[0].title, 'Operations at Scale in MENA Lead');
  assert.equal(jobs[0].company, 'Example Co');
  assert.equal(jobs[0].location, 'Giza, Egypt');
});

test('recovers a truncated title from the canonical WUZZUF URL', () => {
  const html = '<a href="https://wuzzuf.net/jobs/p/1v6zxgkq5j35-tender-business-operations-coordinator-advanced-control-giza-egypt">Tender &amp; Business Operations C... at Advanced control in 6th of October, Giza, Egypt</a>';
  assert.equal(parseWuzzufJobList(html)[0].title, 'Tender Business Operations Coordinator');
});

test('drops duplicate and untrusted URLs', () => {
  const duplicate = row('abc', 'Strategy Manager at Acme in Cairo, Egypt');
  const evil = '<a href="https://evil.example/jobs/p/nope">Nope at Evil in Cairo</a>';
  assert.equal(parseWuzzufJobList(`${duplicate}${duplicate}${evil}`).length, 1);
});

test('detect is explicit and fetch uses the one public index request', async () => {
  assert.equal(provider.detect({ provider: 'wuzzuf' })?.url, 'https://wuzzuf.net/sitemap-updates/job-list');
  assert.equal(provider.detect({ careers_url: 'https://wuzzuf.net/search/jobs/' }), null);
  const calls = [];
  const jobs = await provider.fetch(
    { provider: 'wuzzuf' },
    {
      maxPages: 1,
      fetchText: async (url, options) => {
        calls.push({ url, options });
        return row('abc', 'Business Operations Manager at Acme in Cairo, Egypt');
      },
    },
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://wuzzuf.net/sitemap-updates/job-list');
  assert.equal(calls[0].options.redirect, 'error');
  assert.equal(jobs.length, 1);
});

test('anti-bot and recognizable parser-drift responses fail loudly', () => {
  assert.throws(() => parseWuzzufJobList('<title>Just a moment...</title><p>Verify you are human</p>'), /access blocked/i);
  assert.throws(() => parseWuzzufJobList('<h1>All Jobs</h1><p>markup changed</p>'), /shape changed/i);
});
