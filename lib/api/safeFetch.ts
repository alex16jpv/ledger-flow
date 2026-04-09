import type { ProxyResponse } from "@/lib/api/proxy";

/**
 * Wrapper around fetch + JSON parsing that handles network errors
 * and non-JSON responses uniformly.
 */
export async function safeFetch<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<ProxyResponse<T>> {
  try {
    const res = await fetch(input, init);
    const contentType = res.headers.get("content-type");
    const isJson = contentType?.includes("application/json");

    if (!isJson) {
      return {
        data: null,
        status: res.status,
        error: `Unexpected response (${res.status}): ${res.statusText}`,
      };
    }

    return await res.json();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error";
    return { data: null, status: 0, error: message };
  }
}
