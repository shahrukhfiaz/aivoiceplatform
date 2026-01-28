'use client';
import { env } from 'next-runtime-env';

const API_URL = env('NEXT_PUBLIC_API_URL') ?? 'http://localhost:3001';
const TOKEN_KEY = 'dsai-admin-token';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function getStoredToken() {
  if (typeof window === 'undefined') {
    return null;
  }
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null) {
  if (typeof window === 'undefined') {
    return;
  }
  if (!token) {
    localStorage.removeItem(TOKEN_KEY);
    return;
  }
  localStorage.setItem(TOKEN_KEY, token);
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

interface ApiFetchOptions extends RequestInit {
  query?: Record<string, string | number | undefined>;
  paginated?: boolean;
}

export async function apiFetch<T>(endpoint: string, init: ApiFetchOptions = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(init.headers);

  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  } else {
    // If no token and we're making an authenticated request, throw error immediately
    if (typeof window !== 'undefined') {
      throw new ApiError('No authentication token found. Please log in again.', 401);
    }
  }

  const url = new URL(`${API_URL}${endpoint}`);
  if (init.query) {
    Object.entries(init.query).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const { paginated, ...fetchInit } = init;

  const response = await fetch(url.toString(), {
    ...fetchInit,
    headers,
    cache: 'no-store', // Prevent browser caching of API responses
  });

  if (!response.ok) {
    const message = await extractErrorMessage(response);
    const error = new ApiError(message, response.status);
    
    // Handle 401 Unauthorized - token expired or invalid
    if (response.status === 401 && typeof window !== 'undefined') {
      // Clear invalid token
      setStoredToken(null);
      // Optionally trigger a custom event for auth providers to handle
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }
    
    throw error;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const data = (await response.json()) as unknown;

  if (paginated) {
    if (Array.isArray(data)) {
      const fallback = {
        data,
        total: data.length,
        page: 1,
        limit: data.length,
        hasNextPage: false,
        hasPreviousPage: false,
      } satisfies PaginatedResponse<unknown>;
      return fallback as T;
    }

    if (data && typeof data === 'object' && 'data' in data) {
      return data as T;
    }
    throw new ApiError('Risposta della API priva del payload paginato atteso', response.status);
  }

  return data as T;
}

async function extractErrorMessage(response: Response) {
  try {
    const data = await response.json();
    if (data?.message) {
      return Array.isArray(data.message) ? data.message.join(', ') : data.message;
    }
  } catch {
    // ignore JSON parse issues
  }
  return response.statusText || 'Unknown error';
}

export function getApiUrl() {
  return API_URL;
}

export { TOKEN_KEY };
