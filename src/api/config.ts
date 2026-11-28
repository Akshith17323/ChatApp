import type { ApiConfig } from './types';

/**
 * Server presets surfaced on the Auth and Settings screens.
 * Keep IPs out of source — users enter their own server address.
 * `localhost` is the only built-in preset; the Android-emulator alias
 * is added at runtime by the UI when Platform.OS === 'android'.
 */
export const SERVER_PRESETS: { label: string; url: string }[] = [
  { label: 'localhost:3000', url: 'http://localhost:3000' },
];

export const DEFAULT_BASE_URL = SERVER_PRESETS[0].url;

let currentConfig: ApiConfig = {
  baseUrl: DEFAULT_BASE_URL,
  username: '',
  password: '',
};

export function setApiConfig(config: Partial<ApiConfig>) {
  currentConfig = {
    ...currentConfig,
    ...config,
    // Strip trailing slashes
    baseUrl: config.baseUrl ? config.baseUrl.replace(/\/+$/, '') : currentConfig.baseUrl,
  };
}

export function getApiConfig(): ApiConfig {
  return currentConfig;
}

/**
 * Returns a standard RFC 7617 Basic Authorization header:
 *   Authorization: Basic <base64(UTF-8 username:password)>
 *
 * The backend's `readBasicCredentials` already decodes base64.
 */
export function getAuthHeader(): string | null {
  if (!currentConfig.username || !currentConfig.password) {
    return null;
  }
  const credentials = `${currentConfig.username}:${currentConfig.password}`;
  // btoa works on ASCII — but usernames/passwords may contain Unicode.
  // Encode as UTF-8 first, then base64.
  const encoded = btoa(
    String.fromCodePoint(
      ...new TextEncoder().encode(credentials),
    ),
  );
  return `Basic ${encoded}`;
}

export interface RequestOptions extends RequestInit {
  timeoutMs?: number;
}

/**
 * Core HTTP client for the Chat App backend.
 * Handles authentication header injection, timeout, and NestJS error formatting.
 */
export async function apiFetch<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { baseUrl } = currentConfig;
  const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const authHeader = getAuthHeader();
  if (authHeader && !headers['Authorization']) {
    headers['Authorization'] = authHeader;
  }

  const timeoutMs = options.timeoutMs ?? 10000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });

    // Handle 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    const contentType = response.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');
    const responseData = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      const errorMessage =
        typeof responseData === 'object' && responseData !== null
          ? Array.isArray(responseData.message)
            ? responseData.message.join(', ')
            : responseData.message || responseData.error || `HTTP ${response.status}`
          : responseData || `HTTP ${response.status}`;

      const error = new Error(errorMessage);
      (error as any).status = response.status;
      (error as any).data = responseData;
      throw error;
    }

    return responseData as T;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error(
        `Connection timed out. Could not reach ${url}. Please verify your device is connected to the same Wi-Fi/network and the server is running.`
      );
    }
    if (
      error.message === 'Failed to fetch' ||
      error.message === 'Network request failed' ||
      error.message?.includes('NetworkError')
    ) {
      throw new Error(
        `Cannot connect to server at ${baseUrl}. Please check that the backend is running and reachable.`
      );
    }
    throw error;
  } finally {
    // Keep the timeout active while reading the body, not only until headers arrive.
    clearTimeout(timeoutId);
  }
}
