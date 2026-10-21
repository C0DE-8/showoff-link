import http from './http'

export const paymentDetails = () => http.get('/api/shop/payment-details')
export const submitTopup = (data) => http.post('/api/shop/submit-request', data)
export const getPendingPurchases = () => http.get('/api/shop/admin/pending-purchases')
export const resolveTopup = (requestId, action) => http.post('/api/shop/verify-topup', { requestId, action })
export const updatePaymentAccount = (data) => http.put('/api/shop/admin/update-account', data)
