import session from 'express-session';

export class MySQLSessionStore extends session.Store {
  constructor(pool) {
    super();
    this.pool = pool;
    this.closed = false;
    this.cleanupTimer = setInterval(() => {
      this.pool.execute('DELETE FROM sessions WHERE expires_at <= UTC_TIMESTAMP(3)').catch(() => {});
    }, 60 * 60 * 1000);
    this.cleanupTimer.unref?.();
  }

  get(sid, callback) {
    this.pool.execute('SELECT data, expires_at FROM sessions WHERE session_id = ? AND expires_at > UTC_TIMESTAMP(3)', [sid])
      .then(([rows]) => callback(null, rows.length ? JSON.parse(rows[0].data) : null))
      .catch(callback);
  }

  set(sid, sess, callback = () => {}) {
    const expires = sess.cookie?.expires ? new Date(sess.cookie.expires) : new Date(Date.now() + 8 * 60 * 60 * 1000);
    const data = JSON.stringify(sess);
    this.pool.execute(
      'INSERT INTO sessions (session_id, expires_at, data) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE expires_at = VALUES(expires_at), data = VALUES(data)',
      [sid, expires, data]
    ).then(() => callback(null)).catch(callback);
  }

  touch(sid, sess, callback = () => {}) {
    const expires = sess.cookie?.expires ? new Date(sess.cookie.expires) : new Date(Date.now() + 8 * 60 * 60 * 1000);
    this.pool.execute('UPDATE sessions SET expires_at = ?, data = ? WHERE session_id = ?', [expires, JSON.stringify(sess), sid])
      .then(() => callback(null)).catch(callback);
  }

  destroy(sid, callback = () => {}) {
    this.pool.execute('DELETE FROM sessions WHERE session_id = ?', [sid]).then(() => callback(null)).catch(callback);
  }

  async close() {
    if (!this.closed) {
      this.closed = true;
      clearInterval(this.cleanupTimer);
    }
  }
}

export function createSessionMiddleware({ pool, secret, secure = false, store = new MySQLSessionStore(pool) }) {
  return session({
    name: 'ebm.sid', secret, store, resave: false, saveUninitialized: false,
    rolling: true, cookie: { httpOnly: true, sameSite: 'lax', secure, maxAge: 8 * 60 * 60 * 1000, path: '/' }
  });
}
