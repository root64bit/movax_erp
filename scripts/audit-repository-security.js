import { readdir, readFile } from 'node:fs/promises';
import { extname, join, basename } from 'node:path';

const roots = ['src', 'e2e', 'supabase/functions', 'scripts'];
const extensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.toml', '.env']);
const secretPatterns = [
  { label: 'JWT-like Supabase service key', regex: /(?:service[_-]?role|SUPABASE_SERVICE_ROLE_KEY)[^\n]{0,80}(eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,})/gi },
  { label: 'private key material', regex: /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/g },
  { label: 'Stripe secret key', regex: /\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/g },
  { label: 'Google API key', regex: /\bAIza[0-9A-Za-z_-]{30,}\b/g },
];
const findings = [];

async function walk(dir) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full);
    else if (extensions.has(extname(entry.name)) || basename(entry.name).startsWith('.env')) {
      const text = await readFile(full, 'utf8');
      for (const rule of secretPatterns) {
        const matches = [...text.matchAll(rule.regex)];
        for (const match of matches) {
          const line = text.slice(0, match.index).split('\n').length;
          findings.push(`${full}:${line} ${rule.label}`);
        }
        rule.regex.lastIndex = 0;
      }
    }
  }
}

for (const root of roots) await walk(root);
if (findings.length) {
  console.error('Repository security audit failed:\n' + findings.join('\n'));
  process.exit(1);
}
console.log('Repository security audit passed: no embedded high-risk key patterns found.');
