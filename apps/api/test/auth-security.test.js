import test from 'node:test';
import assert from 'node:assert/strict';
import { DUMMY_PASSWORD_HASH, verifyLoginPassword, verifyPassword } from '../src/passwords.js';

test('unknown account login still invokes the password verifier with a valid scrypt dummy hash', async () => {
  const calls = [];
  const verifier = async (password, encodedHash) => {
    calls.push({ password, encodedHash });
    return false;
  };
  assert.equal(await verifyLoginPassword('invalid-password', null, verifier), false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].encodedHash, DUMMY_PASSWORD_HASH);
  assert.match(DUMMY_PASSWORD_HASH, /^scrypt\$16384\$8\$1\$[\da-f]+\$[\da-f]{128}$/);
  assert.equal(await verifyPassword('invalid-password', DUMMY_PASSWORD_HASH), false);
});

test('known account login verifies the stored password hash through the same helper', async () => {
  const calls = [];
  const verifier = async (password, encodedHash) => {
    calls.push({ password, encodedHash });
    return true;
  };
  assert.equal(await verifyLoginPassword('valid-password', 'stored-hash', verifier), true);
  assert.deepEqual(calls, [{ password: 'valid-password', encodedHash: 'stored-hash' }]);
});
