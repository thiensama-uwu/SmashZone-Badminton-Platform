// Token storage helpers
const TOKEN_KEY = 'cb_access_token';
const REFRESH_KEY = 'cb_refresh_token';

export const tokenStore = {
  getAccess: () => localStorage.getItem(TOKEN_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  set: (accessToken, refreshToken) => {
    localStorage.setItem(TOKEN_KEY, accessToken);
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

let isRefreshing = false;
let pendingQueue = [];

function processQueue(error, token = null) {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  pendingQueue = [];
}

async function attemptRefresh() {
  const refreshToken = tokenStore.getRefresh();
  if (!refreshToken) throw new Error('No refresh token');
  const res = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) throw new Error('Refresh failed');
  const data = await res.json();
  tokenStore.set(data.accessToken, data.refreshToken);
  return data.accessToken;
}

export async function request(method, path, { body, headers = {}, idempotencyKey } = {}) {
  const doFetch = async (token) => {
    const reqHeaders = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      ...headers,
    };
    return fetch(`/api${path}`, {
      method,
      headers: reqHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let res = await doFetch(tokenStore.getAccess());

  if (res.status === 401) {
    const isPublicAuthRoute =
      path.startsWith('/auth/login') ||
      path.startsWith('/auth/google') ||
      path.startsWith('/auth/register') ||
      path.startsWith('/auth/forgot-password') ||
      path.startsWith('/auth/reset-password') ||
      path.startsWith('/auth/refresh');

    if (isPublicAuthRoute || !tokenStore.getRefresh()) {
      return parseResponse(res);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingQueue.push({ resolve, reject });
      }).then((newToken) => doFetch(newToken).then(parseResponse));
    }

    isRefreshing = true;
    try {
      const newToken = await attemptRefresh();
      processQueue(null, newToken);
      res = await doFetch(newToken);
    } catch (err) {
      processQueue(err, null);
      tokenStore.clear();
      window.location.href = '/auth/login';
      throw err;
    } finally {
      isRefreshing = false;
    }
  }

  return parseResponse(res);
}

async function parseResponse(res) {
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const err = new Error(data.message || `HTTP ${res.status}`);
    err.code = data.code;
    err.status = res.status;
    throw err;
  }
  return data;
}
