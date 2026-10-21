import http from './http'

export const uploadNote = (data) => http.post('/api/note/upload-note', data)
export const readNote = (id) => http.get(`/api/note/read-note/${encodeURIComponent(id)}`)
export const previewNote = (id) => http.get(`/api/note/preview/${encodeURIComponent(id)}`)
export const registerNoteView = (id) => http.post(`/api/note/register-view/${encodeURIComponent(id)}`)
