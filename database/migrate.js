import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import mysql from '../apps/api/node_modules/mysql2/promise.js';
import { databaseConfig } from '../apps/api/src/db.js';

const here = dirname(fileURLToPath(import.meta.url));
try { process.loadEnvFile(resolve(here, '../apps/api/.env')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const migrations = resolve(here, 'migrations');
const pool = mysql.createPool(databaseConfig());
try {
  await pool.execute(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(190) NOT NULL PRIMARY KEY, applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  const files = (await readdir(migrations)).filter((file) => file.endsWith('.sql')).sort();
  for (const file of files) {
    const [existing] = await pool.execute('SELECT version FROM schema_migrations WHERE version = ?', [file]);
    if (existing.length) continue;
    const sql = await readFile(resolve(migrations, file), 'utf8');
    const statements = sql.split(';').map((statement) => statement.trim()).filter(Boolean);
    for (const statement of statements) await pool.query(statement);
    await pool.execute('INSERT INTO schema_migrations (version) VALUES (?)', [file]);
    process.stdout.write(`Applied ${file}\n`);
  }
} catch (error) {
  process.stderr.write(`Migration failed: ${error.message}\n`);
  process.exitCode = 1;
} finally { await pool.end(); }
