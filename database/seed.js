import mysql from '../apps/api/node_modules/mysql2/promise.js';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { databaseConfig } from '../apps/api/src/db.js';
import { hashPassword } from '../apps/api/src/passwords.js';

const here = dirname(fileURLToPath(import.meta.url));
try { process.loadEnvFile(resolve(here, '../apps/api/.env')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const pool = mysql.createPool(databaseConfig());
const password = process.env.DEMO_PASSWORD || 'DemoOnly!2026';
try {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute("INSERT INTO cities (name, slug) VALUES ('Demo City A', 'demo-city-a') ON DUPLICATE KEY UPDATE name = VALUES(name)");
    await connection.execute("INSERT INTO cities (name, slug) VALUES ('Demo City B', 'demo-city-b') ON DUPLICATE KEY UPDATE name = VALUES(name)");
    const [[cityA]] = await connection.execute("SELECT id FROM cities WHERE slug = 'demo-city-a'");
    const [[cityB]] = await connection.execute("SELECT id FROM cities WHERE slug = 'demo-city-b'");
    await connection.execute("INSERT INTO barangays (city_id, name, code, slug) VALUES (?, 'Demo Barangay A', 'DMA', 'demo-a') ON DUPLICATE KEY UPDATE city_id = VALUES(city_id), name = VALUES(name)", [cityA.id]);
    await connection.execute("INSERT INTO barangays (city_id, name, code, slug) VALUES (?, 'Demo Barangay B', 'DMB', 'demo-b') ON DUPLICATE KEY UPDATE city_id = VALUES(city_id), name = VALUES(name)", [cityB.id]);
    const [[barangayA]] = await connection.execute("SELECT id FROM barangays WHERE slug = 'demo-a'");
    const [[barangayB]] = await connection.execute("SELECT id FROM barangays WHERE slug = 'demo-b'");
    const passwordHash = await hashPassword(password);
    for (const [username, displayName, barangayId] of [
      ['demo_a', 'Demo Staff A', barangayA.id], ['demo_b', 'Demo Staff B', barangayB.id]
    ]) {
      await connection.execute(
        'INSERT INTO users (barangay_id, username, password_hash, display_name, is_active) VALUES (?, ?, ?, ?, 1) ON DUPLICATE KEY UPDATE barangay_id = VALUES(barangay_id), password_hash = VALUES(password_hash), display_name = VALUES(display_name), is_active = 1',
        [barangayId, username, passwordHash, displayName]
      );
    }
    await connection.commit();
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
  process.stdout.write('Seeded synthetic Demo City A/B, Demo Barangay A/B, and demo_a/demo_b accounts.\n');
} catch (error) {
  process.stderr.write(`Seed failed: ${error.message}\n`);
  process.exitCode = 1;
} finally { await pool.end(); }
