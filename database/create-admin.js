import mysql from '../apps/api/node_modules/mysql2/promise.js';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { databaseConfig } from '../apps/api/src/db.js';
import { hashPassword } from '../apps/api/src/passwords.js';
import { validateNewAccount } from '../apps/api/src/validation.js';

const here = dirname(fileURLToPath(import.meta.url));
try { process.loadEnvFile(resolve(here, '../apps/api/.env')); } catch (error) { if (error.code !== 'ENOENT') throw error; }

// Usage: node database/create-admin.js <barangay-slug> <username> "<Display Name>" with NEW_ADMIN_PASSWORD in the environment.
async function main() {
  const [slug, username, displayName] = process.argv.slice(2);
  if (!slug || !username || !displayName) throw new Error('Usage: npm run db:create-admin -- <barangay-slug> <username> "<Display Name>" (set NEW_ADMIN_PASSWORD first)');
  const checked = validateNewAccount({ username, display_name: displayName, role: 'admin', password: process.env.NEW_ADMIN_PASSWORD || '' });
  if (!checked.ok) throw new Error(`Invalid account (${Object.entries(checked.fields).map(([field, message]) => `${field}: ${message}`).join('; ')}). NEW_ADMIN_PASSWORD must be 10 to 128 characters.`);
  const pool = mysql.createPool(databaseConfig());
  try {
    const [[barangay]] = await pool.execute('SELECT id, name FROM barangays WHERE slug = ?', [slug]);
    if (!barangay) throw new Error(`No barangay has the slug "${slug}".`);
    const passwordHash = await hashPassword(checked.value.password);
    try {
      await pool.execute(
        'INSERT INTO users (barangay_id, username, password_hash, display_name, role, is_active) VALUES (?, ?, ?, ?, ?, 1)',
        [barangay.id, checked.value.username, passwordHash, checked.value.display_name, 'admin']
      );
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') throw new Error(`The username "${checked.value.username}" is already taken.`);
      throw error;
    }
    process.stdout.write(`Created active administrator "${checked.value.username}" for ${barangay.name}.\n`);
  } finally { await pool.end(); }
}

try { await main(); } catch (error) {
  process.stderr.write(`Create admin failed: ${error.message}\n`);
  process.exitCode = 1;
}
