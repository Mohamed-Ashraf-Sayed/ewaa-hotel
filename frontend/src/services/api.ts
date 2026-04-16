import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

// Auth
export const authApi = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  getMe: () => api.get('/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.put('/auth/change-password', { currentPassword, newPassword })
};

// Users
export const usersApi = {
  getAll: () => api.get('/users'),
  getOrgChart: () => api.get('/users/org-chart'),
  create: (data: any) => api.post('/users', data),
  update: (id: number, data: any) => api.put(`/users/${id}`, data),
  resetPassword: (id: number, newPassword: string) => api.put(`/users/${id}/reset-password`, { newPassword }),
  updateCommission: (id: number, commissionRate: number) => api.put(`/users/${id}/commission`, { commissionRate })
};

// Hotels
export const hotelsApi = {
  getAll: () => api.get('/hotels'),
  create: (data: any) => api.post('/hotels', data),
  update: (id: number, data: any) => api.put(`/hotels/${id}`, data)
};

// Clients
export const clientsApi = {
  getAll: (params?: { type?: string; search?: string; hotelId?: number }) =>
    api.get('/clients', { params }),
  getOne: (id: number) => api.get(`/clients/${id}`),
  create: (data: any) => api.post('/clients', data),
  update: (id: number, data: any) => api.put(`/clients/${id}`, data),
  delete: (id: number) => api.delete(`/clients/${id}`)
};

// Contracts
export const contractsApi = {
  getAll: (params?: { status?: string; hotelId?: number; clientId?: number; search?: string }) =>
    api.get('/contracts', { params }),
  getOne: (id: number) => api.get(`/contracts/${id}`),
  getExpiring: (days?: number) => api.get('/contracts/expiring', { params: { days } }),
  upload: (formData: FormData) => api.post('/contracts', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  approve: (id: number, status: 'approved' | 'rejected', notes?: string) =>
    api.put(`/contracts/${id}/approve`, { status, notes }),
  download: (id: number) => api.get(`/contracts/${id}/download`, { responseType: 'blob' })
};

// Visits
export const visitsApi = {
  getAll: (params?: { clientId?: number; upcoming?: boolean }) => api.get('/visits', { params }),
  getFollowUps: (days?: number) => api.get('/visits/follow-ups', { params: { days } }),
  create: (data: any) => api.post('/visits', data),
  update: (id: number, data: any) => api.put(`/visits/${id}`, data)
};

// Activities
export const activitiesApi = {
  getAll: (params?: { clientId?: number; limit?: number }) => api.get('/activities', { params }),
  create: (data: any) => api.post('/activities', data)
};

// Payments
export const paymentsApi = {
  getAll: (params?: { contractId?: number; clientId?: number }) => api.get('/payments', { params }),
  getSummary: (params: { contractId?: number; clientId?: number }) => api.get('/payments/summary', { params }),
  create: (data: any) => api.post('/payments', data),
  delete: (id: number) => api.delete(`/payments/${id}`)
};

// Users - Commission
export const usersApi2 = {
  updateCommission: (id: number, commissionRate: number) => api.put(`/users/${id}/commission`, { commissionRate })
};

// Targets
export const targetsApi = {
  getAll: (params?: any) => api.get('/targets', { params }),
  getReport: (params?: any) => api.get('/targets/report', { params }),
  upsert: (data: any) => api.post('/targets', data),
  delete: (id: number) => api.delete(`/targets/${id}`),
};

// PDF
export const pdfApi = {
  generateQuote: (data: any) => api.post('/pdf/quote', data, { responseType: 'blob' }),
  clientReport: (params?: any) => api.get('/pdf/client-report', { params, responseType: 'blob' }),
};

// Notifications
export const notificationsApi = {
  getAll: () => api.get('/notifications'),
  markAllRead: () => api.put('/notifications/read-all'),
  markRead: (id: number) => api.put(`/notifications/${id}/read`),
  generate: () => api.post('/notifications/generate'),
};

// Tasks
export const tasksApi = {
  getAll: (params?: any) => api.get('/tasks', { params }),
  create: (data: any) => api.post('/tasks', data),
  update: (id: number, data: any) => api.put(`/tasks/${id}`, data),
  delete: (id: number) => api.delete(`/tasks/${id}`),
};

// Gamification
export const gamificationApi = {
  getLeaderboard: (params?: any) => api.get('/gamification/leaderboard', { params }),
  rate: (data: any) => api.post('/gamification/rate', data),
};

// Email
export const emailApi = {
  getSmtpSettings: () => api.get('/email/smtp-settings'),
  saveSmtpSettings: (data: any) => api.put('/email/smtp-settings', data),
  testSmtp: () => api.post('/email/test'),
  send: (data: any, files?: File[]) => {
    const fd = new FormData();
    fd.append('to', data.to);
    if (data.cc) fd.append('cc', data.cc);
    fd.append('subject', data.subject);
    fd.append('body', data.body);
    if (data.clientId) fd.append('clientId', data.clientId);
    if (files) files.forEach(f => fd.append('attachments', f));
    return api.post('/email/send', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  getLogs: (params?: any) => api.get('/email/logs', { params }),
};

// Reminders / Calendar
export const remindersApi = {
  getAll: (params?: any) => api.get('/reminders', { params }),
  create: (data: any) => api.post('/reminders', data),
  update: (id: number, data: any) => api.put(`/reminders/${id}`, data),
  delete: (id: number) => api.delete(`/reminders/${id}`),
  check: () => api.post('/reminders/check'),
};

// Dashboard
export const dashboardApi = {
  get: () => api.get('/dashboard'),
};
