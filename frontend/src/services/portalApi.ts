import axios from 'axios';

// Portal uses a SEPARATE axios instance + storage key from the internal CRM,
// so an internal user logging in doesn't clobber a portal session and vice versa.
const portalApi = axios.create({ baseURL: '/api/portal' });

const TOKEN_KEY = 'portal_token';
const CLIENT_KEY = 'portal_client';

export const getPortalToken = () => localStorage.getItem(TOKEN_KEY);
export const getPortalClient = () => {
  const raw = localStorage.getItem(CLIENT_KEY);
  return raw ? JSON.parse(raw) : null;
};
export const setPortalSession = (token: string, client: any) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(CLIENT_KEY, JSON.stringify(client));
};
export const clearPortalSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(CLIENT_KEY);
};

portalApi.interceptors.request.use((config) => {
  const token = getPortalToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

portalApi.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      clearPortalSession();
      // Avoid bouncing the user to /portal/login if they are already there
      if (!window.location.pathname.startsWith('/portal/login')) {
        window.location.href = '/portal/login';
      }
    }
    return Promise.reject(err);
  }
);

export default portalApi;

// === Auth ===
export const portalAuthApi = {
  requestOtp: (email: string) => portalApi.post('/auth/request-otp', { email }),
  verifyOtp: (email: string, code: string) => portalApi.post('/auth/verify-otp', { email, code }),
};

// === Data ===
export const portalDataApi = {
  me: () => portalApi.get('/me'),
  hotels: () => portalApi.get('/hotels'),
  contracts: () => portalApi.get('/contracts'),
  bookings: () => portalApi.get('/bookings'),
  booking: (id: number) => portalApi.get(`/bookings/${id}`),
  requestBooking: (data: any) => portalApi.post('/bookings', data),
  accountSummary: (month?: string) => portalApi.get('/account-summary', { params: month ? { month } : undefined }),
  statementPdf: (month?: string) => portalApi.get('/statement.pdf', { params: month ? { month } : undefined, responseType: 'blob' }),
};
