import mysql from 'mysql2/promise';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

export function databaseConfig(env = process.env) {
  return {
    host: env.DB_HOST || '127.0.0.1', port: Number(env.DB_PORT || 3306),
    database: env.DB_NAME || 'ebarangaymo', user: env.DB_USER || 'ebarangaymo',
    password: env.DB_PASSWORD || '', connectionLimit: Number(env.DB_CONNECTION_LIMIT || 10),
    waitForConnections: true, queueLimit: 0, timezone: 'Z', dateStrings: true,
    charset: 'utf8mb4', decimalNumbers: true
  };
}

export function createDatabasePool(env = process.env) {
  return mysql.createPool(databaseConfig(env));
}

export function migrationsDirectory() {
  return resolve(here, '../../../database/migrations');
}
