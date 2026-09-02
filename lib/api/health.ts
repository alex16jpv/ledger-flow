export const HEALTH_PATH = "/api/health";
export const HEALTH_TIMEOUT_MS = 5000;

// The heartbeat bypasses the API client on purpose: it must never trigger retries, refreshes or error toasts.
export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(HEALTH_PATH, {
      cache: "no-store",
      credentials: "omit",
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
    return response.ok;
  } catch {
    return false;
  }
}
