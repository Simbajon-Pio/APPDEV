import { Router } from 'express';
import { asyncRoute, conflictError, notFoundError, sendData, validationError } from '../http.js';
import { hashPassword } from '../passwords.js';
import { routeId, validateAccountUpdate, validateNewAccount, validatePasswordReset } from '../validation.js';

const ACCOUNT_FIELDS = 'id, username, display_name, role, is_active, created_at';

function serializeAccount(row) {
  return {
    id: Number(row.id), username: row.username, display_name: row.display_name, role: row.role,
    is_active: Boolean(row.is_active), created_at: new Date(`${String(row.created_at).replace(' ', 'T')}Z`).toISOString()
  };
}

async function findAccount(pool, id, tenantId) {
  const [rows] = await pool.execute(`SELECT ${ACCOUNT_FIELDS} FROM users WHERE id = ? AND barangay_id = ?`, [id, tenantId]);
  if (!rows[0]) throw notFoundError();
  return serializeAccount(rows[0]);
}

// Sessions store the user as JSON, so revoking access means deleting those rows; the caller's own session is kept when requested.
async function deleteUserSessions(pool, userId, keepSessionId) {
  await pool.execute('DELETE FROM sessions WHERE JSON_EXTRACT(data, \'$.user.id\') = ? AND session_id <> ?', [userId, keepSessionId]);
}

export function accountsRouter({ pool }) {
  const router = Router();

  router.get('/', asyncRoute(async (req, res) => {
    const [rows] = await pool.execute(`SELECT ${ACCOUNT_FIELDS} FROM users WHERE barangay_id = ? ORDER BY username`, [req.session.user.barangay_id]);
    sendData(res, rows.map(serializeAccount));
  }));

  router.post('/', asyncRoute(async (req, res) => {
    const checked = validateNewAccount(req.body);
    if (!checked.ok) throw validationError(checked.fields);
    const tenantId = req.session.user.barangay_id;
    const { username, display_name: displayName, role, password } = checked.value;
    const passwordHash = await hashPassword(password);
    try {
      const [result] = await pool.execute(
        'INSERT INTO users (barangay_id, username, password_hash, display_name, role, is_active) VALUES (?, ?, ?, ?, ?, 1)',
        [tenantId, username, passwordHash, displayName, role]
      );
      sendData(res, await findAccount(pool, Number(result.insertId), tenantId), 201);
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') throw conflictError('That username is already taken.');
      throw error;
    }
  }));

  router.patch('/:id', asyncRoute(async (req, res) => {
    const id = routeId(req.params.id);
    if (!id) throw validationError({ id: 'Must be a positive integer' });
    const checked = validateAccountUpdate(req.body);
    if (!checked.ok) throw validationError(checked.fields);
    const tenantId = req.session.user.barangay_id;
    const current = await findAccount(pool, id, tenantId);
    const changes = checked.value;
    if (id === req.session.user.id) {
      if (changes.role === 'staff') throw validationError({ role: 'You cannot remove your own administrator access' });
      if (changes.is_active === false) throw validationError({ is_active: 'You cannot remove your own administrator access' });
    }
    const columns = Object.keys(changes);
    if (columns.length) {
      // Column names come from the validated allowlist, never from request keys.
      await pool.execute(
        `UPDATE users SET ${columns.map((column) => `${column} = ?`).join(', ')} WHERE id = ? AND barangay_id = ?`,
        [...columns.map((column) => (column === 'is_active' ? (changes[column] ? 1 : 0) : changes[column])), id, tenantId]
      );
    }
    if (changes.is_active === false || (changes.role !== undefined && changes.role !== current.role)) {
      await deleteUserSessions(pool, id, req.sessionID);
    }
    sendData(res, await findAccount(pool, id, tenantId));
  }));

  router.post('/:id/password', asyncRoute(async (req, res) => {
    const id = routeId(req.params.id);
    if (!id) throw validationError({ id: 'Must be a positive integer' });
    const checked = validatePasswordReset(req.body);
    if (!checked.ok) throw validationError(checked.fields);
    const tenantId = req.session.user.barangay_id;
    await findAccount(pool, id, tenantId);
    const passwordHash = await hashPassword(checked.value.password);
    await pool.execute('UPDATE users SET password_hash = ? WHERE id = ? AND barangay_id = ?', [passwordHash, id, tenantId]);
    await deleteUserSessions(pool, id, req.sessionID);
    sendData(res, { password_reset: true });
  }));

  return router;
}
