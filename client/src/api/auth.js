import http from './http'

export const login = (data) => http.post('/auth/login', data)
export const register = (data) => http.post('/auth/register', data)
export const requestPasswordReset = (data) => http.post('/auth/forgot-password', data)
export const resetPassword = (data) => http.post('/auth/reset-password', data)
