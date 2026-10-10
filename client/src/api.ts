// Address of the NestJS API. It can be changed with VITE_API_URL (see client/.env.example).
export const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

// Error thrown by apiRequest. It keeps the HTTP status and the extra flags sent by the server.
export interface ApiError extends Error {
  status?: number;
  unverified?: boolean;
  expired?: boolean;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  token?: string;
}

// Sends a request to the API and returns the JSON answer.
// If the server answers with an error, it throws an ApiError with the server message.
export async function apiRequest<T = any>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token } = options;

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const data = response.status === 204 ? {} : await response.json();

  if (!response.ok) {
    const error: ApiError = new Error(data.error ?? data.message ?? 'Request failed.');
    error.status = response.status;
    if (data.unverified) error.unverified = true;
    if (data.expired) error.expired = true;
    throw error;
  }

  return data as T;
}
