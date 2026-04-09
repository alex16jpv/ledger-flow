import { cookies } from "next/headers";

const BACKEND_API_URL = process.env.BACKEND_API_URL;
const API_SECRET = process.env.API_SECRET;

export type ProxyResponse<T = unknown> = {
  data: T | null;
  status: number;
  error: string | null;
};

export type Pagination = {
  limit: number;
  offset: number;
  total: number;
  hasMore: boolean;
  nextCursor: string | null;
};

export type PaginatedResult<T> = {
  data: T[];
  pagination: Pagination;
};

type RequestOptions = {
  method?: string;
  headers?: HeadersInit;
  body?: unknown;
  params?: Record<string, string>;
};

export async function proxy<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<ProxyResponse<T>> {
  if (!BACKEND_API_URL) {
    return {
      data: null,
      status: 500,
      error: "BACKEND_API_URL is not configured",
    };
  }

  const { method = "GET", headers: extraHeaders, body, params } = options;

  const url = new URL(path, BACKEND_API_URL);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  const headers = new Headers(extraHeaders);

  if (API_SECRET) {
    headers.set("x-api-secret", API_SECRET);
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const contentType = res.headers.get("content-type");
    const isJson = contentType?.includes("application/json");
    const payload = isJson ? await res.json() : null;

    if (!res.ok) {
      return {
        data: null,
        status: res.status,
        error: payload?.message ?? payload?.error ?? res.statusText,
      };
    }

    return { data: payload as T, status: res.status, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown proxy error";
    return { data: null, status: 502, error: message };
  }
}
