import { request } from './client';
import { uploadsApi } from './uploads';

export const courtsApi = {
  list: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request('GET', `/courts${q ? `?${q}` : ''}`);
  },

  featured: () => request('GET', '/courts/featured'),

  get: (id) => request('GET', `/courts/${id}`),

  getAvailability: (courtId, date) =>
    request('GET', `/courts/availability?courtId=${courtId}&date=${date}`),

  create: (data) => request('POST', '/courts', { body: data }),

  update: (id, data) => request('PATCH', `/courts/${id}`, { body: data }),

  remove: (id) => request('DELETE', `/courts/${id}`),

  getPolicy: (id) => request('GET', `/courts/${id}/policy`),

  addPolicy: (id, data) => request('POST', `/courts/${id}/policies`, { body: data }),

  getPriceSchedules: (id) => request('GET', `/courts/${id}/price-schedules`),

  addPriceSchedule: (id, data) => request('POST', `/courts/${id}/price-schedules`, { body: data }),

  uploadImage: (file) => uploadsApi.uploadImage(file),
};
