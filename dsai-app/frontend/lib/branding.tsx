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
  appName: 'Digital Storming',
  panelName: 'Digital Storming Admin',
  logoUrl: '/ds-logo-square.png',
  faviconUrl: '/favicon.ico',
  primaryColor: null,
  secondaryColor: null,
  accentColor: null,
  destructiveColor: null,
  discordUrl: 'https://digitalstorming.com',
  githubUrl: 'https://digitalstorming.com',
  wikiUrl: 'https://digitalstorming.com',
  loginTitle: null,
  loginDescription: null,
  webrtcPhoneTitle: 'Digital Storming Phone',
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

  // Update document title and favicon when branding changes
  useEffect(() => {
    if (branding) {
      document.title = branding.appName || 'Admin Panel';

      // Update favicon if provided
      if (branding.faviconUrl) {
        const existingFavicon = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
        if (existingFavicon) {
          existingFavicon.href = branding.faviconUrl;
        } else {
          const favicon = document.createElement('link');
          favicon.rel = 'icon';
          favicon.href = branding.faviconUrl;
          document.head.appendChild(favicon);
        }
      }
    }
  }, [branding]);

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
