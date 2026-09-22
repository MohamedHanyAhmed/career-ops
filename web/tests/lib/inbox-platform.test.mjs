import test from "node:test";
import assert from "node:assert/strict";
import { platformCounts, platformFromUrl } from "../../src/lib/inbox-platform.mjs";

test("classifies the public boards and direct ATS hosts used by the inbox", () => {
  const cases = [
    ["https://www.linkedin.com/jobs/view/123", "linkedin"],
    ["https://wuzzuf.net/jobs/p/example", "wuzzuf"],
    ["https://job-boards.greenhouse.io/acme/jobs/1", "greenhouse"],
    ["https://jobs.lever.co/acme/abc", "lever"],
    ["https://jobs.ashbyhq.com/acme/abc", "ashby"],
    ["https://acme.myworkdayjobs.com/en-US/jobs/job/1", "workday"],
  ];
  for (const [url, expected] of cases) assert.equal(platformFromUrl(url), expected, url);
});

test("host matching is boundary-safe and malformed URLs fall into Other", () => {
  assert.equal(platformFromUrl("https://linkedin.com.evil.example/jobs/1"), "other");
  assert.equal(platformFromUrl("not a url"), "other");
});

test("platform counts preserve dashboard order and reconcile to the input population", () => {
  const rows = [
    { url: "https://www.linkedin.com/jobs/view/1" },
    { url: "https://www.linkedin.com/jobs/view/2" },
    { url: "https://wuzzuf.net/jobs/p/3" },
    { url: "https://example.com/jobs/4" },
  ];
  const counts = platformCounts(rows);
  assert.deepEqual(counts, [
    { platform: "linkedin", count: 2 },
    { platform: "wuzzuf", count: 1 },
    { platform: "other", count: 1 },
  ]);
  assert.equal(counts.reduce((sum, row) => sum + row.count, 0), rows.length);
});
