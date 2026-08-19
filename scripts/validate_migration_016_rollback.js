import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';

const migration = 'supabase/migrations/20260728320000_016_users_dynamic_data_and_mobile_security.sql';
const rollback = 'supabase/rollbacks/20260728320000_016_users_dynamic_data_and_mobile_security_undo.sql';
await access(migration, constants.R_OK);
await access(rollback, constants.R_OK);
const [up, down] = await Promise.all([readFile(migration, 'utf8'), readFile(rollback, 'utf8')]);
if (!/get_current_user_context/i.test(up) || !/get_current_user_context/i.test(down)) {
  throw new Error('Migration 016 rollback does not cover get_current_user_context.');
}
if (!/DROP|CREATE OR REPLACE/i.test(down)) {
  throw new Error('Migration 016 rollback does not contain executable rollback operations.');
}
console.log('Migration 016 rollback contract verified.');
