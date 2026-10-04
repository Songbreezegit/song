import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';

// Local production-build verification only. Each server applies the same
// Cloudflare header rules; the second promotes Report-Only to enforcement.
const root = resolve('.security-preview');
const fixtureOrigin = 'https://backend-v1-test.supabase.co';
execFileSync(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'build', '--outDir', root], {
  stdio: 'inherit', env: { ...process.env, VITE_SUPABASE_URL: fixtureOrigin, VITE_SUPABASE_ANON_KEY: 'test-public-key' },
});
const rules = [];
for (const line of readFileSync(resolve(root, '_headers'), 'utf8').split(/\r?\n/)) {
  if (!line.trim() || line.startsWith('#')) continue;
  if (!line.startsWith(' ')) rules.push({ path: line.trim(), headers: {} });
  else {
    const colon = line.indexOf(':');
    rules.at(-1).headers[line.slice(0, colon).trim()] = line.slice(colon + 1).trim()
      .replaceAll('https://vfgmptjfcfgptaqblydd.supabase.co', fixtureOrigin)
      .replaceAll('wss://vfgmptjfcfgptaqblydd.supabase.co', fixtureOrigin.replace('https:', 'wss:'));
  }
}
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json' };
for (const [port, enforce] of [[5180, false], [5181, true]]) {
  createServer((request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const headers = Object.assign({}, ...rules.filter(rule => rule.path === '/*' || rule.path === pathname || (rule.path.endsWith('*') && pathname.startsWith(rule.path.slice(0, -1)))).map(rule => rule.headers));
      if (enforce && headers['Content-Security-Policy-Report-Only']) {
        headers['Content-Security-Policy'] = headers['Content-Security-Policy-Report-Only'];
        delete headers['Content-Security-Policy-Report-Only'];
      }
      const requested = resolve(root, '.' + pathname);
      if (!requested.startsWith(root + sep) && requested !== root) { response.writeHead(400); response.end(); return; }
      const file = existsSync(requested) && statSync(requested).isFile() ? requested : resolve(root, 'index.html');
      response.writeHead(200, { ...headers, 'Content-Type': types[extname(file)] || 'application/octet-stream' });
      response.end(readFileSync(file));
    } catch { response.writeHead(400); response.end(); }
  }).listen(port, '127.0.0.1', () => console.log(`Security preview ${enforce ? 'enforce' : 'report-only'}: http://127.0.0.1:${port}`));
}
