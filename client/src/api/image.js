import http from './http'

export const uploadImage = (formData) => http.post('/api/image/upload-asset', formData)
export const viewImage = (id) => http.get(`/api/image/view-asset/${encodeURIComponent(id)}`, { responseType: 'blob' })
export const previewImage = (id) => http.get(`/api/image/preview/${encodeURIComponent(id)}`, { responseType: 'blob' })
export const purgeImage = (id) => http.delete(`/api/image/purge-asset/${encodeURIComponent(id)}`)
