import { randomBytes, scrypt as scryptCallback, scryptSync, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;
const DUMMY_SALT = 'c962e85503727e3044e0a1cd98fb2441';
const DUMMY_DIGEST = scryptSync('dummy-password-not-a-user-secret', DUMMY_SALT, KEY_LENGTH, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }).toString('hex');
export const DUMMY_PASSWORD_HASH = `scrypt$16384$8$1$${DUMMY_SALT}$${DUMMY_DIGEST}`;

export async function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const derived = await scrypt(password, salt, KEY_LENGTH, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$16384$8$1$${salt}$${Buffer.from(derived).toString('hex')}`;
}

export async function verifyPassword(password, encoded) {
  if (typeof encoded !== 'string') return false;
  const [algorithm, n, r, p, salt, digest] = encoded.split('$');
  if (algorithm !== 'scrypt' || Number(n) !== 16384 || Number(r) !== 8 || Number(p) !== 1 || !salt || !/^[\da-f]{128}$/i.test(digest || '')) return false;
  try {
    const actual = Buffer.from(await scrypt(password, salt, KEY_LENGTH, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }));
    return timingSafeEqual(actual, Buffer.from(digest, 'hex'));
  } catch { return false; }
}

export async function verifyLoginPassword(password, encoded, verifier = verifyPassword) {
  return verifier(password, encoded || DUMMY_PASSWORD_HASH);
}

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString('base64url');
}
