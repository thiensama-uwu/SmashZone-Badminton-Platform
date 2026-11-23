import { request } from './client';

export const paymentsApi = {
  create: (data, idempotencyKey) =>
    request('POST', '/payments', { body: data, idempotencyKey }),

  get: (id) => request('GET', `/payments/${id}`),

  refundByBooking: (bookingId, data) =>
    request('POST', `/payments/booking/${bookingId}/refund`, { body: data }),

  listRefunds: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request('GET', `/payments/refunds${q ? `?${q}` : ''}`);
  },

  markRefundTransferred: (id) =>
    request('POST', `/payments/refunds/${id}/mark-transferred`),

  manualCompleteRefund: (id, data) =>
    request('POST', `/payments/refunds/${id}/manual-complete`, { body: data }),

  failRefund: (id, data) =>
    request('POST', `/payments/refunds/${id}/fail`, { body: data }),

  retryRefund: (id, data) =>
    request('POST', `/payments/refunds/${id}/retry`, { body: data }),
};

export const notificationsApi = {
  list: () => request('GET', '/notifications'),

  markRead: (id) => request('POST', '/notifications/mark-read', { body: { ids: [id] } }),

  markAllRead: () => request('POST', '/notifications/mark-read', { body: { ids: [] } }),

  subscribe: (subscription) =>
    request('POST', '/notifications/subscriptions', {
      body: {
        endpoint: subscription.endpoint,
        publicKey: subscription.keys?.p256dh || subscription.publicKey,
        authSecret: subscription.keys?.auth || subscription.authSecret,
      },
    }),
};

export const usersApi = {
  getProfile: () => request('GET', '/users/me'),

  updateProfile: (data) => request('PATCH', '/users/me', { body: data }),
};

export const adminUsersApi = {
  list: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request('GET', `/admin/users${q ? `?${q}` : ''}`);
  },

  get: (id) => request('GET', `/admin/users/${id}`),

  create: (data) => request('POST', '/admin/users', { body: data }),

  update: (id, data) => request('PATCH', `/admin/users/${id}`, { body: data }),

  remove: (id) => request('DELETE', `/admin/users/${id}`),
};

export const reportsApi = {
  getSummary: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request('GET', `/reports/summary${q ? `?${q}` : ''}`);
  },

  getRevenue: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request('GET', `/reports/revenue${q ? `?${q}` : ''}`);
  },

  getExportData: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request('GET', `/reports/export${q ? `?${q}` : ''}`);
  },
};
