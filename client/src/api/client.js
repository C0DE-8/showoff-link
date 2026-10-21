import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://api.showoff.c0de8.space',
  headers: { Accept: 'application/json' },
  timeout: 20000,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('showoff_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use((response) => response, (error) => {
  if (error.response?.status === 401 && !error.config?.url?.includes('/auth/login')) {
    window.dispatchEvent(new Event('showoff:unauthorized'))
  }
  return Promise.reject(error)
})

export const authApi = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  forgotPassword: (data) => api.post('/auth/forgot-password', data),
  resetPassword: (data) => api.post('/auth/reset-password', data),
}
export const userApi = {
  profile: () => api.get('/api/user/profile'),
  updateTagname: (new_tagname) => api.put('/api/user/update-tagname', { new_tagname }),
  giftTokens: (data) => api.post('/api/user/gift-tokens', data),
}
export const adminApi = {
  users: () => api.get('/api/admin/users'),
  verifyUser: (id, isVerified) => api.patch(`/api/admin/users/${id}/verification`, { isVerified }),
  resetUserPassword: (id, newPassword) => api.patch(`/api/admin/users/${id}/password`, { newPassword }),
  deleteUser: (id) => api.delete(`/api/admin/users/${id}`),
  pendingPurchases: () => api.get('/api/shop/admin/pending-purchases'),
  verifyTopup: (requestId, action) => api.post('/api/shop/verify-topup', { requestId, action }),
  uploadSkin: (formData) => api.post('/api/admin/admin/upload-skin', formData),
  updatePaymentAccount: (data) => api.put('/api/shop/admin/update-account', data),
}
export const shopApi = {
  paymentDetails: () => api.get('/api/shop/payment-details'),
  submitTopup: (data) => api.post('/api/shop/submit-request', data),
}
export const contentApi = {
  uploadNote: (data) => api.post('/api/note/upload-note', data),
  uploadImage: (data) => api.post('/api/image/upload-asset', data),
  uploadVoice: (data) => api.post('/api/audio/upload-voice', data),
  skins: () => api.get('/api/skin/skins/all-images'),
  inventory: () => api.get('/api/skin/skins/inventory'),
}
export default api
