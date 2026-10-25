import http from './http'

export const uploadVoice = (formData) => http.post('/api/audio/upload-voice', formData)
export const previewVoice = async (id) => {
  const response = await http.get(`/api/audio/preview/${encodeURIComponent(id)}`, { responseType: 'blob' })
  return URL.createObjectURL(response.data)
}
export const streamVoiceUrl = (id) => {
  const url = new URL(`/api/audio/stream-voice/${encodeURIComponent(id)}`, http.defaults.baseURL)
  const token = localStorage.getItem('showoff_token')
  if (token) url.searchParams.set('token', token)
  return url.toString()
}
export const fetchVoice = async (id) => {
  let response
  try {
    response = await http.get(`/api/audio/stream-voice/${encodeURIComponent(id)}`, { responseType: 'blob' })
  } catch (error) {
    let apiMessage = ''
    const body = error.response?.data
    if (body instanceof Blob) {
      try {
        const details = JSON.parse(await body.text())
        apiMessage = details.error || ''
      } catch { /* Non-JSON proxy responses use the HTTP status below. */ }
    }
    const message = apiMessage || (error.response?.status === 410
      ? 'This recording has reached its play limit.'
      : error.response?.status === 403
        ? 'This recording is private to a different account.'
        : error.message || 'Could not load this recording.')
    throw new Error(message, { cause: error })
  }
  if (!response.data.size) throw new Error('The saved recording is empty.')
  return {
    url: URL.createObjectURL(response.data),
    skinImage: response.headers['x-skin-image'] || ''
  }
}
export const registerVoicePlay = (id) => http.post(`/api/audio/register-play/${encodeURIComponent(id)}`)
