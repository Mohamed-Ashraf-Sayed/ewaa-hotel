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
    api.put('/auth/change-password', { currentPassword, newPassword }),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  verifyResetCode: (email: string, code: string) => api.post('/auth/verify-reset-code', { email, code }),
  resetPassword: (resetToken: string, newPassword: string) =>
    api.post('/auth/reset-password', { resetToken, newPassword }),
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
  delete: (id: number) => api.delete(`/clients/${id}`),
  lookup: (params: { regNo?: string; taxNo?: string }) => api.get('/clients/lookup', { params }),
  bulkImport: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/clients/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};

// Contracts
export const contractsApi = {
  getAll: (params?: { status?: string; hotelId?: number; clientId?: number; salesRepId?: number; search?: string }) =>
    api.get('/contracts', { params }),
  getOne: (id: number) => api.get(`/contracts/${id}`),
  getExpiring: (days?: number) => api.get('/contracts/expiring', { params: { days } }),
  upload: (formData: FormData) => api.post('/contracts', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  approve: (id: number, status: 'approved' | 'rejected', notes?: string) =>
    api.put(`/contracts/${id}/approve`, { status, notes }),
  confirmBooking: (id: number, bookingNotes?: string, file?: File) => {
    const fd = new FormData();
    if (bookingNotes) fd.append('bookingNotes', bookingNotes);
    if (file) fd.append('confirmationLetter', file);
    return api.put(`/contracts/${id}/confirm-booking`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  download: (id: number) => api.get(`/contracts/${id}/download`, { responseType: 'blob' })
};

// Visits
export const visitsApi = {
  getAll: (params?: { clientId?: number; upcoming?: boolean; salesRepId?: number }) => api.get('/visits', { params }),
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
  getAll: (params?: { contractId?: number; clientId?: number; status?: string }) => api.get('/payments', { params }),
  getSummary: (params: { contractId?: number; clientId?: number }) => api.get('/payments/summary', { params }),
  create: (data: any) => {
    if (data instanceof FormData) {
      return api.post('/payments', data, { headers: { 'Content-Type': 'multipart/form-data' } });
    }
    return api.post('/payments', data);
  },
  approve: (id: number) => api.post(`/payments/${id}/approve`),
  reject: (id: number, approvalNotes?: string) => api.post(`/payments/${id}/reject`, { approvalNotes }),
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
  contractsReport: (params?: any) => api.get('/pdf/contracts-report', { params, responseType: 'blob' }),
  visitsReport: (params?: any) => api.get('/pdf/visits-report', { params, responseType: 'blob' }),
  paymentsReport: (params?: any) => api.get('/pdf/payments-report', { params, responseType: 'blob' }),
  paymentMethodsReport: (params?: any) => api.get('/pdf/payment-methods-report', { params, responseType: 'blob' }),
  teamReport: (params?: any) => api.get('/pdf/team-report', { params, responseType: 'blob' }),
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
  getPendingCount: () => api.get('/tasks/count'),
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

// Inbox (incoming client emails)
export const inboxApi = {
  list: (params?: { unreadOnly?: boolean; clientId?: number; q?: string; take?: number }) =>
    api.get('/inbox', { params }),
  getOne: (id: number) => api.get(`/inbox/${id}`),
  markRead: (id: number, isRead = true) => api.put(`/inbox/${id}/read`, { isRead }),
  markAllRead: () => api.put('/inbox/read-all'),
  pollNow: () => api.post('/inbox/poll-now'),
};

// AI Assistant
export const aiApi = {
  ask: (question: string, history?: { role: 'user' | 'assistant'; content: string }[]) =>
    api.post('/ai/ask', { question, history }),
};

// IMAP accounts (mailboxes the system polls)
export const imapApi = {
  list: () => api.get('/imap-accounts'),
  create: (data: any) => api.post('/imap-accounts', data),
  update: (id: number, data: any) => api.put(`/imap-accounts/${id}`, data),
  remove: (id: number) => api.delete(`/imap-accounts/${id}`),
  test: (id: number) => api.post(`/imap-accounts/${id}/test`),
  pollNow: () => api.post('/imap-accounts/poll-now'),
};

// Client Attachments
export const attachmentsApi = {
  list: (clientId: number) => api.get(`/clients/${clientId}/attachments`),
  upload: (clientId: number, formData: FormData) =>
    api.post(`/clients/${clientId}/attachments`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  delete: (id: number) => api.delete(`/attachments/${id}`),
  download: (id: number) => api.get(`/attachments/${id}/download`, { responseType: 'blob' }),
};

// Messages / Chat
export const messagesApi = {
  getContacts: () => api.get('/messages/contacts'),
  getConversation: (userId: number) => api.get(`/messages/with/${userId}`),
  send: (toUserId: number, content: string, file?: File) => {
    const fd = new FormData();
    fd.append('toUserId', String(toUserId));
    fd.append('content', content);
    if (file) fd.append('attachment', file);
    return api.post('/messages', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  broadcast: (content: string) => api.post('/messages/broadcast', { content }),
  getUnreadCount: () => api.get('/messages/unread-count'),
};

// Local Events / Holidays
export const localEventsApi = {
  getAll: (params?: { month?: number; year?: number; type?: string }) =>
    api.get('/local-events', { params }),
  create: (data: any) => api.post('/local-events', data),
  update: (id: number, data: any) => api.put(`/local-events/${id}`, data),
  delete: (id: number) => api.delete(`/local-events/${id}`),
  sync: () => api.post('/local-events/sync'),
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

// Bookings
export const bookingsApi = {
  getAll: (params?: { status?: string; hotelId?: number; clientId?: number; assignedRepId?: number; search?: string; fromDate?: string; toDate?: string }) =>
    api.get('/bookings', { params }),
  getOne: (id: number) => api.get(`/bookings/${id}`),
  getByClient: (clientId: number) => api.get(`/bookings/client/${clientId}`),
  create: (data: any, file?: File) => {
    const fd = new FormData();
    Object.keys(data).forEach(k => {
      const v = data[k];
      if (v !== undefined && v !== null && v !== '') fd.append(k, String(v));
    });
    if (file) fd.append('confirmationLetter', file);
    return api.post('/bookings', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  update: (id: number, data: any, file?: File) => {
    const fd = new FormData();
    Object.keys(data).forEach(k => {
      const v = data[k];
      if (v !== undefined && v !== null && v !== '') fd.append(k, String(v));
    });
    if (file) fd.append('confirmationLetter', file);
    return api.put(`/bookings/${id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  updateStatus: (id: number, status: string, opts?: { cancellationReason?: string; statusReason?: string }) =>
    api.put(`/bookings/${id}/status`, { status, ...(opts || {}) }),
  delete: (id: number) => api.delete(`/bookings/${id}`),
  extract: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/bookings/extract', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  history: (id: number) => api.get(`/bookings/${id}/history`),
};
