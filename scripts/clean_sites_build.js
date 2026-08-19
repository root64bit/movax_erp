import { rm } from 'node:fs/promises';

for (const target of ['dist', '.vercel/output']) {
  await rm(target, { recursive: true, force: true });
}
console.log('Build workspace cleaned.');
