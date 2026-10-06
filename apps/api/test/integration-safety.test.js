import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const testFile = resolve(dirname(fileURLToPath(import.meta.url)), 'integration/workflows.test.js');
const node = process.execPath;

test('integration workflow refuses an unspecified or unsafe database target before running', () => {
  const missing = spawnSync(node, ['--test-force-exit', testFile], {
    env: { ...process.env, TEST_DB_NAME: '', TEST_DB_HOST: '127.0.0.1' }, encoding: 'utf8'
  });
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr + missing.stdout, /TEST_DB_NAME must explicitly name an isolated database ending in _test/);

  const remote = spawnSync(node, ['--test-force-exit', testFile], {
    env: { ...process.env, TEST_DB_NAME: 'ebarangaymo_test', TEST_DB_HOST: 'dbadmin.example.invalid' }, encoding: 'utf8'
  });
  assert.notEqual(remote.status, 0);
  assert.match(remote.stderr + remote.stdout, /TEST_DB_HOST must be loopback/);

  const unmarked = spawnSync(node, ['--test-force-exit', testFile], {
    env: { ...process.env, TEST_DB_NAME: 'ebarangaymo', TEST_DB_HOST: '127.0.0.1' }, encoding: 'utf8'
  });
  assert.notEqual(unmarked.status, 0);
  assert.match(unmarked.stderr + unmarked.stdout, /TEST_DB_NAME must explicitly name an isolated database ending in _test/);
});
