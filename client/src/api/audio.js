import http from './http'

export const uploadVoice = (formData) => http.post('/api/audio/upload-voice', formData)
export const streamVoiceUrl = (id) => `${http.defaults.baseURL}/api/audio/stream-voice/${encodeURIComponent(id)}`
export const registerVoicePlay = (id) => http.post(`/api/audio/register-play/${encodeURIComponent(id)}`)
