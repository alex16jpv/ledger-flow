export interface SecurityHeaderOptions {
  nonce: string;
  isDevelopment: boolean;
  reportOnly: boolean;
  reportUri: string;
}

export function buildCsp({
  nonce,
  isDevelopment,
  reportUri,
}: Omit<SecurityHeaderOptions, "reportOnly">): string {
  const scriptSrc = [
    `'self'`,
    `'nonce-${nonce}'`,
    `'strict-dynamic'`,
    ...(isDevelopment ? [`'unsafe-eval'`] : []),
  ];
  const directives = [
    `default-src 'self'`,
    `script-src ${scriptSrc.join(" ")}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self'`,
    `connect-src 'self'`,
    `worker-src 'self'`,
    `manifest-src 'self'`,
    `frame-ancestors ${isDevelopment ? "'self'" : "'none'"}`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
    `report-uri ${reportUri}`,
    ...(isDevelopment ? [] : [`upgrade-insecure-requests`]),
  ];
  return directives.join("; ");
}

export const CSP_HEADER = "Content-Security-Policy";
export const CSP_REPORT_ONLY_HEADER = "Content-Security-Policy-Report-Only";

export function cspHeaderName(reportOnly: boolean): string {
  return reportOnly ? CSP_REPORT_ONLY_HEADER : CSP_HEADER;
}

export function newNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

// Development allows same-origin framing so /dev/frame can show the app at phone width.
export function staticSecurityHeaders(isDevelopment: boolean): { key: string; value: string }[] {
  return [
    { key: "X-Frame-Options", value: isDevelopment ? "SAMEORIGIN" : "DENY" },
    ...STATIC_SECURITY_HEADERS,
  ];
}

export const STATIC_SECURITY_HEADERS: { key: string; value: string }[] = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=(), browsing-topics=()",
  },
];

export const HSTS_HEADER = {
  key: "Strict-Transport-Security",
  value: "max-age=63072000; includeSubDomains; preload",
};
