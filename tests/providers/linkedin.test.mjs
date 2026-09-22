import assert from 'node:assert/strict';
import test from 'node:test';

import provider, { normalizeLinkedInJob } from '../../providers/linkedin.mjs';

test('detects only explicitly configured LinkedIn entries', () => {
  assert.deepEqual(provider.detect({ provider: 'linkedin' }), { url: 'https://www.linkedin.com/jobs/' });
  assert.equal(provider.detect({ careers_url: 'https://www.linkedin.com/jobs/' }), null);
});

test('normalizes a LinkedIn job and removes tracking parameters', () => {
  const job = normalizeLinkedInJob({
    title: ' Senior Business Operations Specialist ',
    company: ' Example Co ',
    location: ' Cairo, Egypt ',
    jobUrl: 'https://www.linkedin.com/jobs/view/4467726056/?trackingId=secret',
    datePosted: '2026-09-15',
    description: ' Full role description ',
    minAmount: 3000,
    maxAmount: 4500,
    currency: 'usd',
  });
  assert.deepEqual(job, {
    title: 'Senior Business Operations Specialist',
    company: 'Example Co',
    location: 'Cairo, Egypt',
    url: 'https://www.linkedin.com/jobs/view/4467726056',
    postedAt: Date.parse('2026-09-15T00:00:00Z'),
    description: 'Full role description',
    salary: { min: 3000, max: 4500, currency: 'USD' },
  });
});

test('rejects non-LinkedIn and malformed job URLs', () => {
  assert.equal(normalizeLinkedInJob({ title: 'Role', jobUrl: 'https://evil.example/jobs/view/1' }), null);
  assert.equal(normalizeLinkedInJob({ title: 'Role', jobUrl: 'javascript:alert(1)' }), null);
  assert.equal(normalizeLinkedInJob({ title: '', jobUrl: 'https://www.linkedin.com/jobs/view/123' }), null);
});

test('does not invent a zero salary from null source fields', () => {
  const job = normalizeLinkedInJob({
    title: 'Business Operations Manager',
    company: 'Example',
    location: 'Dubai, United Arab Emirates',
    jobUrl: 'https://www.linkedin.com/jobs/view/1234567890',
    minAmount: null,
    maxAmount: null,
    currency: null,
  });
  assert.equal(Object.hasOwn(job, 'salary'), false);
});
