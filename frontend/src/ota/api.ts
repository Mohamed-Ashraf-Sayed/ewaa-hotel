// OTA analytics API helpers — ported from ewaa-bookings. Re-uses the main
// CRM axios instance (with JWT interceptor) and prefixes every URL with
// `/ota/...` so the routes land on the mounted /api/ota/* backend handlers.
import axios from 'axios';

const api = axios.create({ baseURL: '/api/ota' });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export interface Summary {
  range: { from: string; to: string };
  totals: { new: number; cancellation: number; modification: number; net: number; cancellationRate: number };
  bySource: Record<string, { new: number; cancellation: number; modification: number }>;
}

export interface HotelRow {
  hotelId: number;
  hotelName: string;
  hotelNameEn?: string;
  city?: string;
  new: number;
  cancellation: number;
  modification: number;
  net: number;
  cancellationRate: number;
}

export interface TimelinePoint {
  bucket: string;
  new: number;
  cancellation: number;
  modification: number;
}

export interface SourceRow {
  source: string;
  new: number;
  cancellation: number;
  modification: number;
  net: number;
  cancellationRate: number;
}

export interface Hotel {
  id: number;
  name: string;
  nameEn?: string;
  city?: string;
  bookingComId?: string;
  _count?: { reservations: number; events: number };
}

export interface Reservation {
  id: number;
  externalId: string;
  source: string;
  hotel?: Hotel;
  guestName?: string;
  checkIn?: string;
  checkOut?: string;
  nights?: number;
  roomType?: string;
  totalPrice?: number;
  currency?: string;
  currentStatus: string;
  firstSeenAt: string;
  lastUpdatedAt: string;
  _count?: { events: number };
  events?: Array<{
    id: number;
    eventType: string;
    occurredAt: string;
    snapshot: string;
    email?: { subject: string; fromAddr: string; receivedAt: string };
  }>;
}

function rangeParams(from: Date, to: Date) {
  return { from: from.toISOString(), to: to.toISOString() };
}

export const fetchSummary = (from: Date, to: Date) =>
  api.get<Summary>('/analytics/summary', { params: rangeParams(from, to) }).then((r) => r.data);

export const fetchByHotel = (from: Date, to: Date) =>
  api.get<{ hotels: HotelRow[] }>('/analytics/by-hotel', { params: rangeParams(from, to) }).then((r) => r.data);

export const fetchTimeline = (from: Date, to: Date, granularity = 'day', hotelId?: number) =>
  api
    .get<{ series: TimelinePoint[] }>('/analytics/timeline', {
      params: { ...rangeParams(from, to), granularity, hotelId },
    })
    .then((r) => r.data);

export const fetchBySource = (from: Date, to: Date) =>
  api.get<{ sources: SourceRow[] }>('/analytics/by-source', { params: rangeParams(from, to) }).then((r) => r.data);

export interface HotelPlatformDayRow {
  hotelId: number | null;
  hotelName: string | null;
  hotelNameEn: string | null;
  city: string | null;
  bookingComId: string | null;
  agodaId: string | null;
  source: string;
  day: string;
  newCount: number;
  cancelCount: number;
  modCount: number;
  net: number;
}

export const fetchHotelPlatformDay = (from: Date, to: Date) =>
  api.get<{ rows: HotelPlatformDayRow[] }>('/analytics/by-hotel-platform-day', { params: rangeParams(from, to) }).then((r) => r.data);

export const fetchHotels = () => api.get<Hotel[]>('/hotels').then((r) => r.data);

export const fetchReservations = (params: Record<string, any>) =>
  api.get<{ items: Reservation[]; total: number; page: number; pageSize: number }>('/reservations', { params }).then((r) => r.data);

export const fetchReservation = (id: number) =>
  api.get<Reservation>(`/reservations/${id}`).then((r) => r.data);

export interface ImapAccount {
  id?: number;
  name: string;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  mailbox: string;
  pollIntervalSec: number;
  enabled: boolean;
  lastPollAt?: string | null;
  lastError?: string | null;
  lastTestedAt?: string | null;
  lastTestOk?: boolean | null;
}

export interface TestResult {
  ok: boolean;
  mailbox?: string;
  messages?: number;
  unseen?: number;
  error?: string;
}

export const fetchImapSettings = () =>
  api.get<{ account: ImapAccount | null }>('/settings/imap').then((r) => r.data.account);

export const saveImapSettings = (data: Partial<ImapAccount>) =>
  api.post<{ account: ImapAccount }>('/settings/imap', data).then((r) => r.data.account);

export const testImapConnection = (data: Partial<ImapAccount>) =>
  api.post<TestResult>('/settings/imap/test', data).then((r) => r.data).catch((err) => err.response?.data || { ok: false, error: err.message });

export interface RunNowResult {
  ok: boolean;
  processed?: number;
  errors?: number;
  error?: string;
  results?: Array<{ uid: number; subject: string; status: string }>;
}

export const runPollNow = () =>
  api.post<RunNowResult>('/settings/imap/run-now').then((r) => r.data).catch((err) => err.response?.data || { ok: false, error: err.message });

export const resetData = () =>
  api.post<{ ok: boolean; deleted: any }>('/settings/imap/reset').then((r) => r.data);

export interface PollProgress {
  ok: boolean;
  hasAccount: boolean;
  lastSeenUid: number | null;
  oldestSeenUid: number | null;
  serverMessageCount: number;
  lastPollAt: string | null;
  backfillDone: boolean;
  totalFetched: number;
  emailCount: number;
  stats: { parsed: number; skipped: number; failed: number; manualReview: number };
  reservations: number;
}

export const fetchProgress = () =>
  api.get<PollProgress>('/settings/imap/progress').then((r) => r.data);

// === Branch inventory (rooms per branch, used to size OTA bookings) ===
export interface InventoryItem {
  id: number;
  brand: string; // muhaidib_serviced | awa_hotels | grand_plaza
  name: string;
  rooms: number;
  isActive: boolean;
}
export interface InventoryByBrand { brand: string; branches: number; rooms: number; }
export interface InventoryResponse {
  items: InventoryItem[];
  byBrand: InventoryByBrand[];
  totalBranches: number;
  totalRooms: number;
}

export const fetchInventory = () => api.get<InventoryResponse>('/inventory').then(r => r.data);
export const updateInventory = (id: number, data: Partial<InventoryItem>) =>
  api.put<InventoryItem>(`/inventory/${id}`, data).then(r => r.data);

export const BRAND_AR: Record<string, string> = {
  muhaidib_serviced: 'شقق المهيدب المخدومة',
  awa_hotels:        'فنادق إيواء',
  grand_plaza:       'جراند بلازا',
};
