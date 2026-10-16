import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * API base URL. A server address saved in the app (sign-in screen) wins, so an
 * installed build can be pointed at a Mac, a Raspberry Pi, etc. without
 * rebuilding. Otherwise EXPO_PUBLIC_API_URL, otherwise in development we reuse
 * the IP of the machine running Metro.
 */
function defaultBaseUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host) return `http://${host}:4000`;
  return Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';
}

export const DEFAULT_API_URL = defaultBaseUrl();
let baseUrl = DEFAULT_API_URL;

export const getApiUrl = () => baseUrl;
export const setApiUrl = (url: string | null) => (baseUrl = url ? normalizeUrl(url) : DEFAULT_API_URL);

/** "192.168.1.20" → "http://192.168.1.20:4000"; keeps explicit scheme/port. */
export function normalizeUrl(input: string) {
  let url = input.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(url)) url = `http://${url}`;
  const hasPort = /^https?:\/\/[^/]+:\d+/i.test(url);
  if (!hasPort && url.startsWith('http://')) url = url.replace(/^(http:\/\/[^/]+)/i, '$1:4000');
  return url;
}

/** True if a Macro Kitchen server answers at `url`. */
export async function checkServer(url: string) {
  try {
    const res = await fetch(`${normalizeUrl(url)}/health`, { signal: AbortSignal.timeout(6000) });
    return res.ok && (await res.json()).ok === true;
  } catch {
    return false;
  }
}

let token: string | null = null;
let onUnauthorized: (() => void) | null = null;

export const setToken = (t: string | null) => (token = t);
export const setUnauthorizedHandler = (fn: () => void) => (onUnauthorized = fn);

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(baseUrl + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, `Can't reach the server at ${baseUrl}. Is it running?`);
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized?.();
    throw new ApiError(res.status, data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const get = <T = any>(path: string) => api<T>('GET', path);
export const post = <T = any>(path: string, body?: unknown) => api<T>('POST', path, body ?? {});
export const put = <T = any>(path: string, body: unknown) => api<T>('PUT', path, body);
export const patch = <T = any>(path: string, body: unknown) => api<T>('PATCH', path, body);
export const del = <T = any>(path: string) => api<T>('DELETE', path);
