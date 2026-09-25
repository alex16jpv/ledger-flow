import { ImageResponse } from "next/og";

import { BRAND_GREEN, BRAND_MARK_PATHS } from "./brand-mark";

// Brand mark rendered on demand (favicon, apple-touch-icon, manifest icons); satori needs literal colors.
export function brandIcon(size: number, { maskable = false } = {}) {
  const padding = maskable ? size * 0.2 : size * 0.08;
  const radius = maskable ? 0 : size * 0.22;
  const mark = size - padding * 2;
  return new ImageResponse(
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: BRAND_GREEN,
        borderRadius: radius,
      }}
    >
      <BrandMark size={mark * 0.62} />
    </div>,
    { width: size, height: size },
  );
}

export function BrandMark({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#ffffff"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {BRAND_MARK_PATHS.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
