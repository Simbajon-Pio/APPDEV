export class ApiError extends Error {
  constructor({ status, code = 'INTERNAL_ERROR', message = 'The request could not be completed.', fields = {} }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

let csrfToken = null;
let onUnauthorized = () => {};

export function setCsrfToken(token) {
  csrfToken = token || null;
}

export function setUnauthorizedHandler(handler) {
  onUnauthorized = typeof handler === 'function' ? handler : () => {};
}

async function request(path, { method = 'GET', body, publicRequest = false, includeMeta = false } = {}) {
  const headers = new Headers({ Accept: 'application/json' });
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  if (!publicRequest && method !== 'GET' && csrfToken) headers.set('X-CSRF-Token', csrfToken);
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: 'include',
      cache: 'no-store',
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'The service is unavailable. Check your connection and try again.' });
  }

  let envelope;
  try {
    envelope = await response.json();
  } catch {
    envelope = null;
  }
  if (!response.ok) {
    const error = envelope?.error || {};
    if (response.status === 401 && !publicRequest) {
      csrfToken = null;
      onUnauthorized();
    }
    throw new ApiError({ status: response.status, code: error.code, message: error.message || 'The request could not be completed.', fields: error.fields || {} });
  }
  if (!envelope || !Object.prototype.hasOwnProperty.call(envelope, 'data')) {
    throw new ApiError({ status: response.status, code: 'INVALID_RESPONSE', message: 'The service returned an unreadable response.' });
  }
  if (includeMeta) {
    const meta = envelope.meta;
    if (!Array.isArray(envelope.data) || !meta || !Number.isSafeInteger(meta.page) || !Number.isSafeInteger(meta.page_size) || !Number.isSafeInteger(meta.total) || !Number.isSafeInteger(meta.total_pages)) {
      throw new ApiError({ status: response.status, code: 'INVALID_RESPONSE', message: 'The service returned an unreadable list response.' });
    }
    return { items: envelope.data, meta };
  }
  return envelope.data;
}

export const api = {
  get: (path) => request(path),
  getList: (path) => request(path, { includeMeta: true }),
  post: (path, body) => request(path, { method: 'POST', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  publicGet: (path) => request(path, { publicRequest: true }),
  publicPost: (path, body) => request(path, { method: 'POST', body, publicRequest: true }),
};

export async function bootstrapCsrf() {
  const data = await api.get('/auth/csrf');
  setCsrfToken(data.csrf_token);
  return data.csrf_token;
}

export async function login(credentials) {
  if (!csrfToken) await bootstrapCsrf();
  const data = await api.post('/auth/login', credentials);
  setCsrfToken(data.csrf_token);
  return data;
}

export async function logout() {
  try {
    return await api.post('/auth/logout', {});
  } finally {
    setCsrfToken(null);
  }
}

export function queryString(values) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `?${query}` : '';
}
