import http from './http'

export const getUsers = () => http.get('/api/admin/users')
export const setUserVerification = (userId, isVerified) => http.patch(`/api/admin/users/${encodeURIComponent(userId)}/verification`, { isVerified })
export const resetUserPassword = (userId, newPassword) => http.patch(`/api/admin/users/${encodeURIComponent(userId)}/password`, { newPassword })
export const deleteUser = (userId) => http.delete(`/api/admin/users/${encodeURIComponent(userId)}`)
export const uploadSkin = (formData) => http.post('/api/admin/admin/upload-skin', formData)
