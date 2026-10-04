import { readFileSync, writeFileSync } from 'node:fs';

// Run after verifying Report-Only on the Cloudflare branch preview. Retain
// the same allowlist; never solve violations by enabling unsafe-inline scripts.
const path = new URL('../public/_headers', import.meta.url);
const source = readFileSync(path, 'utf8');
const report = source.match(/^  Content-Security-Policy-Report-Only: (.+)$/m);
if (!report) throw new Error('No Report-Only policy found; inspect the current headers before changing them.');
const result = source.replace(/^  Content-Security-Policy: .+\r?\n/m, '')
  .replace('Content-Security-Policy-Report-Only:', 'Content-Security-Policy:');
writeFileSync(path, result);
console.log('CSP enforcement enabled in public/_headers. Rebuild and deploy the same feature branch.');
