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
// The body is sent as JSON, or as multipart/form-data when it is a FormData (form with files).
// If the server answers with an error, it throws an ApiError with the server message.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- callers without a type parameter keep an untyped answer
export async function apiRequest<T = any>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token } = options;
  const isFormData = body instanceof FormData;

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      // For a FormData, the browser writes the Content-Type itself (with the file separator).
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
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

// The API sends photo paths like "/uploads/abc.jpg". The photos are served by the API server,
// so the full address is the server address (without "/api") followed by the path.
export function photoUrl(path: string): string {
  return `${new URL(API_URL).origin}${path}`;
}
