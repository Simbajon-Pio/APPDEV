import mysql from '../apps/api/node_modules/mysql2/promise.js';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { databaseConfig } from '../apps/api/src/db.js';
import { hashPassword } from '../apps/api/src/passwords.js';
import { CITIES, EXPECTED_BARANGAY_COUNTS } from './barangays.js';

const here = dirname(fileURLToPath(import.meta.url));
try { process.loadEnvFile(resolve(here, '../apps/api/.env')); } catch (error) { if (error.code !== 'ENOENT') throw error; }

// Lowercase ASCII slug; NFD decomposition turns ñ into n plus a combining mark that is then dropped.
export function slugify(text) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const DEMO_ACCOUNTS = [
  ['demo_a', 'Demo Staff A', 'admin', 'cebu-city-lahug'],
  ['demo_b', 'Demo Staff B', 'admin', 'mandaue-city-subangdaku'],
  ['demo_a_staff', 'Demo Desk Staff A', 'staff', 'cebu-city-lahug']
];

const pool = mysql.createPool(databaseConfig());
const password = process.env.DEMO_PASSWORD || 'DemoOnly!2026';
try {
  for (const city of CITIES) {
    const expected = EXPECTED_BARANGAY_COUNTS[city.slug];
    if (city.barangays.length !== expected) throw new Error(`${city.name} lists ${city.barangays.length} barangays; expected ${expected}.`);
  }
  const passwordHash = await hashPassword(password);
  const connection = await pool.getConnection();
  let barangayTotal = 0;
  try {
    await connection.beginTransaction();
    for (const city of CITIES) {
      await connection.execute('INSERT INTO cities (name, slug) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name)', [city.name, city.slug]);
      const [[cityRow]] = await connection.execute('SELECT id FROM cities WHERE slug = ?', [city.slug]);
      for (const [index, name] of city.barangays.entries()) {
        const slug = `${city.slug}-${slugify(name)}`;
        const code = `${city.prefix}${String(index + 1).padStart(3, '0')}`;
        await connection.execute(
          'INSERT INTO barangays (city_id, name, code, slug) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE city_id = VALUES(city_id), name = VALUES(name)',
          [cityRow.id, name, code, slug]
        );
        barangayTotal += 1;
      }
    }
    for (const [username, displayName, role, barangaySlug] of DEMO_ACCOUNTS) {
      const [[barangayRow]] = await connection.execute('SELECT id FROM barangays WHERE slug = ?', [barangaySlug]);
      if (!barangayRow) throw new Error(`Barangay ${barangaySlug} was not seeded.`);
      await connection.execute(
        'INSERT INTO users (barangay_id, username, password_hash, display_name, role, is_active) VALUES (?, ?, ?, ?, ?, 1) ON DUPLICATE KEY UPDATE barangay_id = VALUES(barangay_id), password_hash = VALUES(password_hash), display_name = VALUES(display_name), role = VALUES(role), is_active = 1',
        [barangayRow.id, username, passwordHash, displayName, role]
      );
    }
    await connection.commit();
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
  const cityCounts = CITIES.map((city) => `${city.name} ${city.barangays.length}`).join(', ');
  process.stdout.write(`Seeded ${CITIES.length} cities and ${barangayTotal} barangays (${cityCounts}) and ${DEMO_ACCOUNTS.length} synthetic demo accounts. demo_a and demo_b are administrators of Lahug and Subangdaku; demo_a_staff is staff in Lahug. Existing Demo Barangay A/B rows were not removed.\n`);
} catch (error) {
  process.stderr.write(`Seed failed: ${error.message}\n`);
  process.exitCode = 1;
} finally { await pool.end(); }
