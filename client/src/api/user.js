import http from './http'

export const getProfile = () => http.get('/api/user/profile')
export const getLinks = () => http.get('/api/user/links')
export const updateTagname = (new_tagname) => http.put('/api/user/update-tagname', { new_tagname })
export const giftTokens = (data) => http.post('/api/user/gift-tokens', data)
