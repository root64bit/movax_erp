import { access, readFile, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';

await access('dist/index.html', constants.R_OK);
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
await writeFile('dist/build-info.json', JSON.stringify({
  product: 'Movax ERP',
  package: pkg.name,
  version: pkg.version,
  generatedAt: new Date().toISOString(),
}, null, 2));
// Useful on generic static hosts; harmless on Vercel/CDN deployments.
await writeFile('dist/_redirects', '/* /index.html 200\n');
console.log('Static build verified and prepared.');
