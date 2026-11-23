import { tokenStore } from './client';

export const uploadsApi = {
  uploadImage: async (file) => {
    const formData = new FormData();
    formData.append('image', file);

    const token = tokenStore.getAccess();
    const response = await fetch('/api/uploads/images', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok) {
      throw new Error(data.message || `HTTP ${response.status}`);
    }
    return data;
  },
};
