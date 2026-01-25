'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getApiUrl } from './api';

export interface Branding {
  id: string;
  appName: string;
  panelName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  destructiveColor: string | null;
  discordUrl: string;
  githubUrl: string;
  wikiUrl: string;
  loginTitle: string | null;
  loginDescription: string | null;
  webrtcPhoneTitle: string;
  createdAt: string;
  updatedAt: string;
}

interface BrandingContextValue {
  branding: Branding | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const BrandingContext = createContext<BrandingContextValue | undefined>(undefined);

const defaultBranding: Branding = {
  id: '',
  appName: 'AVR Admin',
  panelName: 'AVR Admin Panel',
  logoUrl: null,
  faviconUrl: null,
  primaryColor: null,
  secondaryColor: null,
  accentColor: null,
  destructiveColor: null,
  discordUrl: 'https://discord.gg/DFTU69Hg74',
  githubUrl: 'https://github.com/orgs/agentvoiceresponse/repositories',
  wikiUrl: 'https://wiki.agentvoiceresponse.com/',
  loginTitle: null,
  loginDescription: null,
  webrtcPhoneTitle: 'AVR Phone',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [branding, setBranding] = useState<Branding | null>(defaultBranding);
  const [loading, setLoading] = useState(true);

  const fetchBranding = useCallback(async () => {
    try {
      const response = await fetch(`${getApiUrl()}/branding`);
      if (!response.ok) {
        console.error('Failed to fetch branding configuration');
        setBranding(defaultBranding);
        return;
      }
      const data = await response.json();
      setBranding(data);
    } catch (error) {
      console.error('Error fetching branding:', error);
      setBranding(defaultBranding);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBranding();
  }, [fetchBranding]);

  const value = useMemo<BrandingContextValue>(
    () => ({
      branding,
      loading,
      refresh: fetchBranding,
    }),
    [branding, loading, fetchBranding],
  );

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  const context = useContext(BrandingContext);
  if (!context) {
    throw new Error('useBranding must be used within BrandingProvider');
  }
  return context;
}
