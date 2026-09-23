import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(path.join(root, 'scan.mjs'), 'utf8');

test('the normal scanner compiles configured company title overrides', () => {
  assert.match(
    source,
    /buildTitleFilterWithOverrides\(\s*config\.title_filter,\s*buildTitleFilterOverrides\(config\.title_filter_overrides\)/,
  );
});

test('the normal scanner supplies the company identity when matching a title', () => {
  assert.match(source, /titleFilter\(job\.title,\s*company\.name\)/);
});
