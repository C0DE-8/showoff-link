import http from './http'

export const uploadVoice = (formData) => http.post('/api/audio/upload-voice', formData)
export const streamVoiceUrl = (id) => {
  const url = new URL(`/api/audio/stream-voice/${encodeURIComponent(id)}`, http.defaults.baseURL)
  const token = localStorage.getItem('showoff_token')
  if (token) url.searchParams.set('token', token)
  return url.toString()
}
export const registerVoicePlay = (id) => http.post(`/api/audio/register-play/${encodeURIComponent(id)}`)
