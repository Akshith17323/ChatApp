import { ApiConfig } from './types';

export const DEFAULT_BASE_URL = 'http://10.7.1.51:3000';

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
 * Returns the exact Authorization header expected by the NestJS AuthGuard:
 * `Basic <username>:<password>` (plain text, NOT base64).
 */
export function getAuthHeader(): string | null {
  if (!currentConfig.username || !currentConfig.password) {
    return null;
  }
  return `Basic ${currentConfig.username}:${currentConfig.password}`;
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

    clearTimeout(timeoutId);

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
    clearTimeout(timeoutId);
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
  }
}
