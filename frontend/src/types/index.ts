export type Role = 'admin' | 'general_manager' | 'vice_gm' | 'sales_director' | 'assistant_sales' | 'sales_rep' | 'contract_officer' | 'reservations' | 'credit_manager' | 'credit_officer';

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  phone?: string;
  managerId?: number;
  isActive: boolean;
  commissionRate?: number;
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
  collectedBy: number;
  createdAt: string;
  contract?: { id: number; contractRef?: string; totalValue?: number };
  client?: { id: number; companyName: string };
  collector?: { id: number; name: string };
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
  estimatedRooms?: number;
  annualBudget?: number;
  website?: string;
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
  status: 'pending' | 'sales_approved' | 'contract_approved' | 'approved' | 'rejected';
  notes?: string;
  contractRef?: string;
  createdAt: string;
  daysUntilExpiry?: number;
  client?: { id: number; companyName: string; contactPerson: string; phone?: string };
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
