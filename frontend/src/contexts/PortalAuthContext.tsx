import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  portalAuthApi,
  portalDataApi,
  getPortalToken,
  getPortalClient,
  setPortalSession,
  clearPortalSession,
} from '../services/portalApi';

export interface PortalClient {
  id: number;
  companyName: string;
  companyNameEn?: string;
  contactPerson: string;
  email?: string;
  phone?: string;
  salesRep?: { id: number; name: string; email?: string; phone?: string };
}

interface PortalAuthContextType {
  client: PortalClient | null;
  token: string | null;
  isLoading: boolean;
  requestOtp: (email: string) => Promise<{ message: string }>;
  verifyOtp: (email: string, code: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const PortalAuthContext = createContext<PortalAuthContextType | null>(null);

export const PortalAuthProvider = ({ children }: { children: ReactNode }) => {
  const [client, setClient] = useState<PortalClient | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const t = getPortalToken();
    const c = getPortalClient();
    if (t && c) {
      setToken(t);
      setClient(c);
      // Refresh from server in background to pick up profile changes
      portalDataApi.me().then(r => {
        setClient(r.data);
        setPortalSession(t, r.data);
      }).catch(() => {
        clearPortalSession();
        setToken(null);
        setClient(null);
      }).finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const requestOtp = async (email: string) => {
    const res = await portalAuthApi.requestOtp(email);
    return res.data;
  };

  const verifyOtp = async (email: string, code: string) => {
    const res = await portalAuthApi.verifyOtp(email, code);
    const { token: t, client: c } = res.data;
    setPortalSession(t, c);
    setToken(t);
    setClient(c);
  };

  const logout = () => {
    clearPortalSession();
    setToken(null);
    setClient(null);
  };

  const refresh = async () => {
    const r = await portalDataApi.me();
    setClient(r.data);
    if (token) setPortalSession(token, r.data);
  };

  return (
    <PortalAuthContext.Provider value={{ client, token, isLoading, requestOtp, verifyOtp, logout, refresh }}>
      {children}
    </PortalAuthContext.Provider>
  );
};

export const usePortalAuth = () => {
  const ctx = useContext(PortalAuthContext);
  if (!ctx) throw new Error('usePortalAuth must be used within PortalAuthProvider');
  return ctx;
};
