import http from './http'

export const getSkins = () => http.get('/api/skin/skins/all-images')
export const getInventory = () => http.get('/api/skin/skins/inventory')
export const buySkin = (id) => http.post(`/api/skin/skins/buy/${encodeURIComponent(id)}`)
export const equipSkin = (id) => http.post(`/api/skin/skins/equip/${encodeURIComponent(id)}`)
