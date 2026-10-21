import axios from 'axios'

const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://api.showoff.c0de8.space',
  headers: { Accept: 'application/json' },
  timeout: 20000,
})

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('showoff_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

http.interceptors.response.use((response) => response, (error) => {
  if (error.response?.status === 401 && !error.config?.url?.includes('/auth/login')) {
    window.dispatchEvent(new Event('showoff:unauthorized'))
  }
  return Promise.reject(error)
})

export default http
