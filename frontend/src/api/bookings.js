import { request } from './client';

export const bookingsApi = {
  hold: (data, idempotencyKey) =>
    request('POST', '/bookings/hold', { body: data, idempotencyKey }),

  create: (bookingId) =>
    request('POST', '/bookings', { body: { bookingId } }),

  get: (id) => request('GET', `/bookings/${id}`),

  history: () => request('GET', '/bookings/history'),

  cancel: (id, data = {}) =>
    request('POST', `/bookings/${id}/cancel`, { body: typeof data === 'string' ? { cancelReason: data } : data }),

  reschedule: (id, data) =>
    request('POST', `/bookings/${id}/reschedule`, { body: data }),

  checkIn: (id) => request('POST', `/bookings/${id}/check-in`),

  complete: (id) => request('POST', `/bookings/${id}/complete`),

  confirmPayment: (id) => request('POST', `/bookings/${id}/confirm-payment`),

  processRefund: (id) => request('POST', `/bookings/${id}/process-refund`),

  markNoShow: (id) => request('POST', `/bookings/${id}/no-show`),

  staffCreate: (data) => request('POST', '/bookings/staff-create', { body: data }),

  listAll: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request('GET', `/bookings/history${q ? `?${q}` : ''}`);
  },
};
