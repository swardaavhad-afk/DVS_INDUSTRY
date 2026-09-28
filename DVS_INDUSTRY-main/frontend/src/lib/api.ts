/**
 * Axios API client — single instance used across the entire frontend.
 *
 * Handles:
 *  - Base URL (proxied through Vite → backend)
 *  - Attaches `Authorization: Bearer <token>` on every request
 *  - On 401 → attempts a silent token refresh then retries the original request once
 *  - On failed refresh → clears auth state and reloads to login
 *  - Normalises errors into a consistent `ApiError` shape
 */

import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
  type AxiosResponse,
  type AxiosError,
} from 'axios';

// ── Constants ─────────────────────────────────────────────────────────────────

export const API_BASE = '/api/v1';
const ACCESS_TOKEN_KEY  = 'dvs_access_token';
const REFRESH_TOKEN_KEY = 'dvs_refresh_token';  // stored as httpOnly cookie by backend; kept here for reference only

// ── Token helpers (accessed by auth.ts too) ──────────────────────────────────

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearAccessToken(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
}

// ── Typed API error ───────────────────────────────────────────────────────────

export interface ApiError {
  status:  number;
  code:    string;
  message: string;
  details?: unknown;
}

export function isApiError(err: unknown): err is ApiError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'status' in err &&
    'code' in err &&
    'message' in err
  );
}

function normaliseError(error: AxiosError): ApiError {
  const data = error.response?.data as {
    error?: { code?: string; message?: string; details?: unknown };
  } | undefined;

  return {
    status:  error.response?.status ?? 0,
    code:    data?.error?.code    ?? 'NETWORK_ERROR',
    message: data?.error?.message ?? error.message ?? 'An unexpected error occurred',
    details: data?.error?.details,
  };
}

// ── Create instance ────────────────────────────────────────────────────────────

const api: AxiosInstance = axios.create({
  baseURL:         API_BASE,
  withCredentials: true,   // send cookies (refresh token) on every request
  timeout:         15_000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor — attach access token ──────────────────────────────────

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor — handle 401 + error normalisation ───────────────────

let isRefreshing    = false;
let refreshQueue:   Array<(token: string) => void> = [];

function processQueue(newToken: string): void {
  refreshQueue.forEach(cb => cb(newToken));
  refreshQueue = [];
}

api.interceptors.response.use(
  (response: AxiosResponse) => response,

  async (error: AxiosError) => {
    const original = error.config as AxiosRequestConfig & { _retry?: boolean };

    // Only attempt refresh for 401s that are NOT the refresh endpoint itself
    if (
      error.response?.status === 401 &&
      !original._retry &&
      !original.url?.includes('/auth/refresh')
    ) {
      if (isRefreshing) {
        // Queue this request until the refresh completes
        return new Promise<AxiosResponse>((resolve, reject) => {
          refreshQueue.push((token: string) => {
            if (!original.headers) original.headers = {};
            original.headers['Authorization'] = `Bearer ${token}`;
            original._retry = true;
            resolve(api(original));
          });
          // If refresh ultimately fails, reject all queued
          setTimeout(() => reject(normaliseError(error)), 10_000);
        });
      }

      original._retry = true;
      isRefreshing    = true;

      try {
        // The refresh token is an httpOnly cookie — just POST with credentials
        const res = await axios.post<{ data: { accessToken: string } }>(
          `${API_BASE}/auth/refresh`,
          {},
          { withCredentials: true },
        );
        const newToken = res.data.data.accessToken;
        setAccessToken(newToken);
        processQueue(newToken);
        if (!original.headers) original.headers = {};
        original.headers['Authorization'] = `Bearer ${newToken}`;
        return api(original);
      } catch {
        // Refresh failed — clear state and force re-login
        clearAccessToken();
        refreshQueue = [];
        window.location.reload();
        return Promise.reject(normaliseError(error));
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(normaliseError(error));
  },
);

export default api;

// ── Typed response helpers ────────────────────────────────────────────────────

export interface PaginatedMeta {
  page:       number;
  pageSize:   number;
  total:      number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: true;
  data:    T;
  message?: string;
  meta?:    PaginatedMeta;
}

/** Unwrap `response.data.data` from the standard envelope */
export function unwrap<T>(res: AxiosResponse<ApiResponse<T>>): T {
  return res.data.data;
}

/** Unwrap both data and pagination meta */
export function unwrapPaged<T>(res: AxiosResponse<ApiResponse<T>>): { data: T; meta: PaginatedMeta } {
  return { data: res.data.data, meta: res.data.meta! };
}
