import test from 'node:test';
import assert from 'node:assert/strict';
import { routeId, validateAccountUpdate, validateBarangayUpdate, validateNewAccount, validatePasswordReset } from '../src/validation.js';
import { requireAdmin } from '../src/http.js';

const goodAccount = { username: '  Desk.Officer_1 ', display_name: ' Desk Officer ', role: 'staff', password: 'correct-horse-1' };

test('new account trims and lowercases username and trims display name', () => {
  const result = validateNewAccount(goodAccount);
  assert.equal(result.ok, true);
  assert.deepEqual(result.value, { username: 'desk.officer_1', display_name: 'Desk Officer', role: 'staff', password: 'correct-horse-1' });
});

test('new account rejects unknown fields, bad usernames, roles and short passwords', () => {
  const result = validateNewAccount({ ...goodAccount, username: 'ab', role: 'superuser', password: 'short', barangay_id: 3 });
  assert.equal(result.ok, false);
  assert.ok(result.fields.username);
  assert.ok(result.fields.role);
  assert.ok(result.fields.password);
  assert.ok(result.fields.barangay_id);
});

test('new account rejects usernames containing spaces or symbols', () => {
  assert.equal(validateNewAccount({ ...goodAccount, username: 'desk officer' }).ok, false);
  assert.equal(validateNewAccount({ ...goodAccount, username: 'desk-officer' }).ok, false);
  assert.equal(validateNewAccount({ ...goodAccount, username: 'x'.repeat(81) }).ok, false);
});

test('new account enforces password length bounds without trimming', () => {
  assert.equal(validateNewAccount({ ...goodAccount, password: '1234567890' }).ok, true);
  assert.equal(validateNewAccount({ ...goodAccount, password: '123456789' }).ok, false);
  assert.equal(validateNewAccount({ ...goodAccount, password: 'x'.repeat(129) }).ok, false);
});

test('new account requires every field and rejects non-object bodies', () => {
  assert.equal(validateNewAccount({}).fields.username, 'Required');
  assert.ok(validateNewAccount({ ...goodAccount, display_name: '   ' }).fields.display_name);
  assert.equal(validateNewAccount({ ...goodAccount, display_name: 'x'.repeat(161) }).ok, false);
  assert.equal(validateNewAccount(null).ok, false);
  assert.equal(validateNewAccount([]).ok, false);
});

test('account update accepts a subset of fields and requires at least one', () => {
  assert.deepEqual(validateAccountUpdate({ role: 'admin' }), { ok: true, value: { role: 'admin' } });
  assert.deepEqual(validateAccountUpdate({ is_active: false, display_name: ' New Name ' }), { ok: true, value: { is_active: false, display_name: 'New Name' } });
  assert.equal(validateAccountUpdate({}).ok, false);
  assert.equal(validateAccountUpdate({ is_active: 'no' }).ok, false);
  assert.equal(validateAccountUpdate({ username: 'renamed' }).ok, false);
  assert.equal(validateAccountUpdate({ role: 'superuser' }).ok, false);
});

test('password reset requires a 10 to 128 character string', () => {
  assert.deepEqual(validatePasswordReset({ password: '1234567890' }), { ok: true, value: { password: '1234567890' } });
  assert.equal(validatePasswordReset({ password: 'short' }).ok, false);
  assert.equal(validatePasswordReset({ password: 1234567890123 }).ok, false);
  assert.equal(validatePasswordReset({ password: 'x'.repeat(10), extra: true }).ok, false);
  assert.equal(validatePasswordReset(undefined).ok, false);
});

test('barangay update trims name and normalizes blank optional values to null', () => {
  assert.deepEqual(validateBarangayUpdate({ name: '  Lahug  ' }), { ok: true, value: { name: 'Lahug' } });
  assert.deepEqual(validateBarangayUpdate({ hall_address: '  ', contact_number: '' }), { ok: true, value: { hall_address: null, contact_number: null } });
  assert.deepEqual(validateBarangayUpdate({ contact_number: '032 123-4567' }), { ok: true, value: { contact_number: '032 123-4567' } });
});

test('barangay update rejects code, slug, invalid contacts and empty names', () => {
  assert.equal(validateBarangayUpdate({ code: 'X' }).ok, false);
  assert.equal(validateBarangayUpdate({ slug: 'x' }).ok, false);
  assert.equal(validateBarangayUpdate({ contact_number: 'call me' }).ok, false);
  assert.equal(validateBarangayUpdate({ name: '' }).ok, false);
  assert.equal(validateBarangayUpdate({}).ok, false);
});

test('route ids must be positive safe integers', () => {
  assert.equal(routeId('12'), 12);
  assert.equal(routeId('0'), null);
  assert.equal(routeId('1.5'), null);
  assert.equal(routeId('abc'), null);
});

test('requireAdmin returns 401 without a user, 403 for staff, and passes admins', () => {
  const run = (session) => {
    let received = 'not called';
    requireAdmin({ session }, {}, (error) => { received = error; });
    return received;
  };
  assert.equal(run({}).status, 401);
  assert.equal(run({ user: { id: 1, role: 'staff' } }).status, 403);
  assert.equal(run({ user: { id: 1, role: 'staff' } }).code, 'FORBIDDEN');
  assert.equal(run({ user: { id: 1, role: 'admin' } }), undefined);
});
