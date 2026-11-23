import { request, tokenStore } from './client';

export const authApi = {
  login: async (identifier, password) => {
    const isPhone = /^\+?\d[\d\s-]{7,}$/.test(identifier);
    const body = isPhone
      ? { phone: identifier, password }
      : { email: identifier, password };
    const data = await request('POST', '/auth/login', { body });
    tokenStore.set(data.accessToken, data.refreshToken);
    return data;
  },

  googleAuth: async (idToken) => {
    const data = await request('POST', '/auth/google', { body: { idToken } });
    tokenStore.set(data.accessToken, data.refreshToken);
    return data;
  },

  register: async (email, phone, password, fullName) => {
    const data = await request('POST', '/auth/register', { body: { email, phone, password, fullName } });
    return data;
  },

  logout: async () => {
    const refreshToken = tokenStore.getRefresh();
    try {
      await request('POST', '/auth/logout', { body: { refreshToken } });
    } finally {
      tokenStore.clear();
    }
  },

  forgotPassword: (email) =>
    request('POST', '/auth/forgot-password', { body: { email } }),

  resetPassword: (email, otp, newPassword) =>
    request('POST', '/auth/reset-password', { body: { email, otp, newPassword } }),

  changePassword: (currentPassword, newPassword) => {
    const body = currentPassword ? { currentPassword, newPassword } : { newPassword };
    return request('POST', '/auth/change-password', { body });
  },
};
