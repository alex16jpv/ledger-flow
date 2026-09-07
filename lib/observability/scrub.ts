import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";

// Amounts and dates are the only numbers worth hiding; short ones (status codes, counts) stay readable.
export function redactNumbers(text: string): string {
  return text.replace(/\d[\d.,]{3,}/g, "#");
}

export function pathOnly(url: string | undefined): string | undefined {
  return url?.split(/[?#]/)[0];
}

// Search filters travel in query strings and descriptions in bodies: neither may leave the app.
export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  if (breadcrumb.category === "console") return null;
  const data: Record<string, unknown> = breadcrumb.data ?? {};
  const text = (value: unknown) => (typeof value === "string" ? value : undefined);
  if (breadcrumb.category === "fetch" || breadcrumb.category === "xhr") {
    return {
      ...breadcrumb,
      message: undefined,
      data: {
        method: text(data.method),
        status_code: typeof data.status_code === "number" ? data.status_code : undefined,
        url: pathOnly(text(data.url)),
      },
    };
  }
  if (breadcrumb.category === "navigation") {
    return {
      ...breadcrumb,
      data: { from: pathOnly(text(data.from)), to: pathOnly(text(data.to)) },
    };
  }
  return { ...breadcrumb, message: breadcrumb.message && redactNumbers(breadcrumb.message) };
}

export function scrubEvent(event: ErrorEvent): ErrorEvent {
  const scrubbed: ErrorEvent = {
    ...event,
    user: undefined,
    extra: undefined,
    request: event.request
      ? { method: event.request.method, url: pathOnly(event.request.url) }
      : undefined,
    message: event.message && redactNumbers(event.message),
    breadcrumbs: event.breadcrumbs
      ?.map(scrubBreadcrumb)
      .filter((crumb): crumb is Breadcrumb => crumb !== null),
  };
  if (event.exception?.values) {
    scrubbed.exception = {
      ...event.exception,
      values: event.exception.values.map((value) => ({
        ...value,
        value: value.value && redactNumbers(value.value),
      })),
    };
  }
  return scrubbed;
}
