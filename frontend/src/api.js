import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  // Add X-Branch-Id header from localStorage
  const branchId = localStorage.getItem('branch_id')
  if (branchId) {
    config.headers['X-Branch-Id'] = branchId
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      localStorage.removeItem('branch_id') // Clear branch_id on logout/401
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api

export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
}

export const dashboardAPI = {
  stats: () => api.get('/dashboard/stats'),
}

export const categoryAPI = {
  list: (search) => api.get('/categories', { params: { search } }),
  get: (id) => api.get(`/categories/${id}`),
  create: (data) => api.post('/categories', data),
  update: (id, data) => api.put(`/categories/${id}`, data),
  delete: (id) => api.delete(`/categories/${id}`),
}

export const productAPI = {
  list: (params) => api.get('/products', { params }),
  get: (id) => api.get(`/products/${id}`),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.put(`/products/${id}`, data),
  delete: (id) => api.delete(`/products/${id}`),
  uploadImage: (file) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post('/products/upload-image', fd, {
      headers: { 'Content-Type': undefined },
    })
  },
  importExcel: (file) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post('/products/import-excel', fd, {
      headers: { 'Content-Type': undefined },
    })
  },
}

export const tableAPI = {
  list: (status) => api.get('/tables', { params: { status } }),
  get: (id) => api.get(`/tables/${id}`),
  create: (data) => api.post('/tables', data),
  update: (id, data) => api.put(`/tables/${id}`, data),
  updateStatus: (id, status) => api.put(`/tables/${id}/status`, null, { params: { status } }),
  delete: (id) => api.delete(`/tables/${id}`),
}

export const orderAPI = {
  list: (params) => api.get('/orders', { params }),
  get: (id) => api.get(`/orders/${id}`),
  create: (data) => api.post('/orders', data),
  void: (id) => api.put(`/orders/${id}/void`),
  delete: (id) => api.delete(`/orders/${id}`),
}

export const paymentAPI = {
  pay: (data) => api.post('/payments/pay', data),
  receipt: (orderId) => api.get(`/payments/receipt/${orderId}`),
}

export const membershipAPI = {
  tiers: {
    list: () => api.get('/memberships/tiers'),
    create: (data) => api.post('/memberships/tiers', data),
    update: (id, data) => api.put(`/memberships/tiers/${id}`, data),
    delete: (id) => api.delete(`/memberships/tiers/${id}`),
  },
  members: {
    list: (params) => api.get('/memberships/members', { params }),
    get: (id) => api.get(`/memberships/members/${id}`),
    create: (data) => api.post('/memberships/members', data),
    update: (id, data) => api.put(`/memberships/members/${id}`, data),
    delete: (id) => api.delete(`/memberships/members/${id}`),
    points: (id) => api.get(`/memberships/members/${id}/points`),
    redeem: (id, points) => api.post(`/memberships/members/${id}/redeem`, null, { params: { points } }),
  },
}

export const reportAPI = {
  summary: (params) => api.get('/reports/summary', { params }),
  topProducts: (params) => api.get('/reports/products/top', { params }),
  lowStock: () => api.get('/reports/products/low-stock'),
  daily: (params) => api.get('/reports/daily', { params }),
  downloadDaily: (params) => api.get('/reports/excel/daily', { params, responseType: 'blob' }),
  downloadMonthly: (params) => api.get('/reports/excel/monthly', { params, responseType: 'blob' }),
  downloadCashier: (params) => api.get('/reports/excel/cashier', { params, responseType: 'blob' }),
}

export const userAPI = {
  list: () => api.get('/users'),
  get: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
}

export const settingAPI = {
  list: () => api.get('/settings'),
  get: (key) => api.get(`/settings/${key}`),
  upsert: (data) => api.post('/settings', data),
  delete: (key) => api.delete(`/settings/${key}`),
}

export const customerAPI = {
  list: (search) => api.get('/customers', { params: { search } }),
  create: (data) => api.post('/customers', data),
}

export const voucherAPI = {
  list: () => api.get('/vouchers'),
  validate: (code, subtotal) => api.post('/vouchers/validate', null, { params: { code, subtotal } }),
}

export const branchAPI = {
  list: () => api.get('/branches'),
  get: (id) => api.get(`/branches/${id}`),
  create: (data) => api.post('/branches', data),
  update: (id, data) => api.put(`/branches/${id}`, data),
  delete: (id) => api.delete(`/branches/${id}`),
}
