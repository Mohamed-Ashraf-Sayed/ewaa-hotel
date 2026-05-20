export type Role = 'admin' | 'general_manager' | 'systems_info' | 'vice_gm' | 'sales_director' | 'assistant_sales' | 'sales_rep' | 'contract_officer' | 'reservations' | 'credit_manager' | 'credit_officer' | 'marketing_manager';

export interface Promotion {
  id: number;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  startsAt: string;
  endsAt: string;
  hotelIds?: string | null;
  brands?: string | null;
  isActive: boolean;
  createdById: number;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: number; name: string };
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  title?: string;
  phone?: string;
  managerId?: number;
  isActive: boolean;
  commissionRate?: number;
  mustChangePassword?: boolean;
  createdAt: string;
  manager?: { id: number; name: string; role: Role };
  hotels?: { hotel: { id: number; name: string } }[];
  _count?: { assignedClients: number; contracts: number };
}

export interface Hotel {
  id: number;
  name: string;
  nameEn?: string;
  location: string;
  city?: string;
  country?: string;
  group?: string;
  stars?: number;
  type?: string;
  isActive: boolean;
  bankName?: string | null;
  beneficiaryName?: string | null;
  nationalId?: string | null;
  accountNumber?: string | null;
  iban?: string | null;
}

export interface Payment {
  id: number;
  contractId: number;
  clientId: number;
  amount: number;
  paymentDate: string;
  paymentType?: string;
  reference?: string;
  notes?: string;
  receiptUrl?: string;
  collectedBy: number;
  status: 'pending' | 'approved' | 'rejected';
  approvedById?: number | null;
  approvedAt?: string | null;
  approvalNotes?: string | null;
  createdAt: string;
  contract?: { id: number; contractRef?: string; totalValue?: number };
  client?: { id: number; companyName: string };
  collector?: { id: number; name: string };
  approver?: { id: number; name: string } | null;
}

export interface PaymentSummary {
  clientId?: number;
  contractId?: number;
  contractRef?: string;
  totalValue: number;
  collected: number;
  remaining: number;
  collectionPct: number;
  commissionRate?: number;
  commissionAmount?: number;
  paymentCount?: number;
  payments?: Payment[];
  contracts?: (Partial<Contract> & { remaining: number; collectionPct: number })[];
  client?: { id: number; companyName: string };
  hotel?: { id: number; name: string };
  salesRep?: { id: number; name: string; commissionRate?: number };
}

export interface PulseScore {
  id: number;
  engagementScore: number;
  visitScore: number;
  contractScore: number;
  recencyScore: number;
  trend: 'up' | 'down' | 'stable';
  riskLevel: 'low' | 'medium' | 'high';
  daysSinceLastVisit?: number;
  suggestedAction?: string;
  lastCalculated: string;
}

export interface Client {
  id: number;
  companyName: string;
  contactPerson: string;
  phone?: string;
  email?: string;
  address?: string;
  industry?: string;
  clientType: 'lead' | 'active' | 'inactive';
  source?: string;
  salesRepId: number;
  hotelId?: number;
  brands?: string;
  estimatedRooms?: number;
  annualBudget?: number;
  creditLimit?: number;
  website?: string;
  commercialRegNo?: string;
  taxCardNo?: string;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  salesRep?: { id: number; name: string };
  hotel?: { id: number; name: string };
  pulseScore?: PulseScore;
  _count?: { contracts: number; visits: number; activities: number };
}

export interface Contract {
  id: number;
  clientId: number;
  hotelId: number;
  salesRepId: number;
  fileUrl?: string;
  fileName?: string;
  roomsCount?: number;
  ratePerRoom?: number;
  startDate?: string;
  endDate?: string;
  totalValue?: number;
  collectedAmount?: number;
  status: 'pending' | 'sales_approved' | 'credit_approved' | 'contract_approved' | 'approved' | 'rejected';
  notes?: string;
  contractRef?: string;
  paymentMethod?: 'bank_transfer' | 'cash' | 'credit';
  bookingConfirmed?: boolean;
  bookingConfirmedAt?: string;
  createdAt: string;
  daysUntilExpiry?: number;
  client?: { id: number; companyName: string; contactPerson: string; phone?: string; creditLimit?: number | null };
  hotel?: { id: number; name: string };
  salesRep?: { id: number; name: string };
  approvals?: ContractApproval[];
  previousContract?: Contract;
}

export interface ContractApproval {
  id: number;
  contractId: number;
  approvedBy: number;
  status: 'approved' | 'rejected';
  notes?: string;
  createdAt: string;
  approver?: { id: number; name: string; role: Role };
}

export interface Visit {
  id: number;
  clientId: number;
  salesRepId: number;
  visitDate: string;
  visitType?: string;
  purpose?: string;
  outcome?: string;
  nextFollowUp?: string;
  notes?: string;
  createdAt: string;
  client?: { id: number; companyName: string; contactPerson: string };
  salesRep?: { id: number; name: string };
}

export interface Activity {
  id: number;
  clientId: number;
  userId: number;
  type: string;
  description: string;
  createdAt: string;
  client?: { id: number; companyName: string };
  user?: { id: number; name: string; role: Role };
}

export type BookingStatus = 'pending_reservations' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show';
export type BookingSource = 'outlook' | 'phone' | 'walk_in' | 'portal' | 'other';

export interface Booking {
  id: number;
  clientId: number;
  hotelId: number;
  contractId?: number | null;
  assignedRepId: number;
  bookedById: number | null;
  submittedByClient?: boolean;
  operaConfirmationNo: string | null;
  guestName: string;
  reservationMadeBy?: string | null;
  arrivalDate: string;
  departureDate: string;
  nights: number;
  roomsCount: number;
  adultsCount: number;
  childrenCount: number;
  roomType?: string | null;
  ratePerNight?: number | null;
  ratePackage?: string | null;
  totalAmount?: number | null;
  currency: string;
  vatPercent: number;
  municipalityFeePercent: number;
  paymentMethod?: string | null;
  source: BookingSource;
  status: BookingStatus;
  cancelledAt?: string | null;
  cancelledById?: number | null;
  cancellationReason?: string | null;
  confirmationLetterUrl?: string | null;
  confirmationLetterName?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  client?: { id: number; companyName: string; contactPerson: string; phone?: string; email?: string };
  hotel?: { id: number; name: string; nameEn?: string };
  contract?: { id: number; contractRef?: string } | null;
  assignedRep?: { id: number; name: string; email?: string };
  bookedBy?: { id: number; name: string };
  cancelledBy?: { id: number; name: string } | null;
}

export interface DashboardData {
  stats: {
    totalClients: number;
    activeClients: number;
    leads: number;
    totalContracts: number;
    pendingContracts: number;
    approvedContracts: number;
    contractsThisMonth: number;
    totalVisits: number;
    visitsThisMonth: number;
  };
  expiringIn30: Contract[];
  upcomingFollowUps: Visit[];
  atRiskClients: PulseScore[];
  hotLeads: PulseScore[];
  recentActivities: Activity[];
  teamPerformance: { id: number; name: string; _count: { assignedClients: number; contracts: number; visits: number } }[];
}
