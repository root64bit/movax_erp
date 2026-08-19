import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const roots = ['src', 'public'];
const allowedExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.html', '.css', '.md']);
const forbidden = [
  { label: 'legacy Casa de Pneus product branding', regex: /Casa\s+de\s+Pneus/gi },
  { label: 'legacy KUVHA product branding', regex: /\bKUVHA\b/gi },
  { label: 'intermediate BemGerido branding', regex: /\bBemGerido\b/gi },
  { label: 'hardcoded pilot address', regex: /Karl\s+Marx/gi },
];
const findings = [];

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full);
    else if (allowedExtensions.has(extname(entry.name))) {
      const text = await readFile(full, 'utf8');
      for (const rule of forbidden) {
        const matches = [...text.matchAll(rule.regex)];
        for (const match of matches) {
          const line = text.slice(0, match.index).split('\n').length;
          findings.push(`${full}:${line} ${rule.label}: ${JSON.stringify(match[0])}`);
        }
        rule.regex.lastIndex = 0;
      }
    }
  }
}

for (const root of roots) await walk(root);
if (findings.length) {
  console.error('Static operational data audit failed:\n' + findings.join('\n'));
  process.exit(1);
}
console.log('Static operational data audit passed. Runtime branding is tenant-neutral.');
