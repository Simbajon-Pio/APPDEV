import { Router } from 'express';
import { verifyLoginPassword, randomToken } from '../passwords.js';
import { asyncRoute, HttpError, requireUser, sendData } from '../http.js';

function publicUser(user, appUrl) {
  return {
    id: Number(user.id), username: user.username, display_name: user.display_name,
    barangay: { id: Number(user.barangay_id), name: user.barangay_name, code: user.barangay_code, slug: user.barangay_slug },
    city: { id: Number(user.city_id), name: user.city_name },
    report_url: `${appUrl.replace(/\/$/, '')}/report/${encodeURIComponent(user.barangay_slug)}`
  };
}

export function authRouter({ pool, appUrl, loginLimiter }) {
  const router = Router();
  router.get('/csrf', (req, res) => {
    if (!req.session.csrfToken) req.session.csrfToken = randomToken();
    res.set('Cache-Control', 'no-store');
    sendData(res, { csrf_token: req.session.csrfToken });
  });

  router.post('/login', loginLimiter, asyncRoute(async (req, res) => {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some((key) => !['username', 'password'].includes(key))) {
      throw new HttpError(422, 'VALIDATION_ERROR', 'Check the marked fields.', { body: 'Username and password are required' });
    }
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!username || username.length > 80 || !password || password.length > 128) throw new HttpError(422, 'VALIDATION_ERROR', 'Check the marked fields.', { username: 'Username or password is invalid' });
    const [rows] = await pool.execute(
      `SELECT u.id, u.username, u.password_hash, u.display_name, u.barangay_id, b.name AS barangay_name,
       b.code AS barangay_code, b.slug AS barangay_slug, b.city_id, c.name AS city_name
       FROM users u JOIN barangays b ON b.id = u.barangay_id JOIN cities c ON c.id = b.city_id
       WHERE u.username = ? AND u.is_active = 1 LIMIT 1`, [username]
    );
    const valid = await verifyLoginPassword(password, rows[0]?.password_hash);
    if (!valid || !rows[0]) throw new HttpError(401, 'UNAUTHENTICATED', 'Username or password is incorrect.');
    await new Promise((resolve, reject) => req.session.regenerate((error) => error ? reject(error) : resolve()));
    req.session.csrfToken = randomToken();
    req.session.user = {
      id: Number(rows[0].id), username: rows[0].username, display_name: rows[0].display_name,
      barangay_id: Number(rows[0].barangay_id), barangay_name: rows[0].barangay_name,
      barangay_code: rows[0].barangay_code, barangay_slug: rows[0].barangay_slug,
      city_id: Number(rows[0].city_id), city_name: rows[0].city_name
    };
    await new Promise((resolve, reject) => req.session.save((error) => error ? reject(error) : resolve()));
    sendData(res, { user: publicUser(req.session.user, appUrl), csrf_token: req.session.csrfToken });
  }));

  router.get('/me', requireUser, (req, res) => sendData(res, { user: publicUser(req.session.user, appUrl), csrf_token: req.session.csrfToken }));
  router.post('/logout', requireUser, asyncRoute(async (req, res) => {
    await new Promise((resolve, reject) => req.session.destroy((error) => error ? reject(error) : resolve()));
    res.clearCookie('ebm.sid', { httpOnly: true, sameSite: 'lax', secure: req.secure, path: '/' });
    sendData(res, { logged_out: true });
  }));
  return router;
}
