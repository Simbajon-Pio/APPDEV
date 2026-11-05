import { Router } from 'express';
import { asyncRoute, notFoundError, requireAdmin, sendData, validationError } from '../http.js';
import { validateBarangayUpdate } from '../validation.js';

async function getOwnBarangay(pool, tenantId, appUrl) {
  const [rows] = await pool.execute(
    'SELECT b.id, b.name, b.code, b.slug, b.hall_address, b.contact_number, b.city_id, c.name AS city_name FROM barangays b JOIN cities c ON c.id = b.city_id WHERE b.id = ?',
    [tenantId]
  );
  if (!rows[0]) throw notFoundError();
  const row = rows[0];
  return {
    id: Number(row.id), name: row.name, code: row.code, slug: row.slug,
    hall_address: row.hall_address, contact_number: row.contact_number,
    city: { id: Number(row.city_id), name: row.city_name },
    report_url: `${appUrl.replace(/\/$/, '')}/report/${encodeURIComponent(row.slug)}`
  };
}

export function barangayRouter({ pool, appUrl }) {
  const router = Router();

  router.get('/', asyncRoute(async (req, res) => {
    sendData(res, await getOwnBarangay(pool, req.session.user.barangay_id, appUrl));
  }));

  router.patch('/', requireAdmin, asyncRoute(async (req, res) => {
    const checked = validateBarangayUpdate(req.body);
    if (!checked.ok) throw validationError(checked.fields);
    const tenantId = req.session.user.barangay_id;
    const changes = checked.value;
    const columns = Object.keys(changes);
    // Column names come from the validated allowlist, never from request keys.
    await pool.execute(
      `UPDATE barangays SET ${columns.map((column) => `${column} = ?`).join(', ')} WHERE id = ?`,
      [...columns.map((column) => changes[column]), tenantId]
    );
    if (changes.name !== undefined) req.session.user.barangay_name = changes.name;
    sendData(res, await getOwnBarangay(pool, tenantId, appUrl));
  }));

  return router;
}
