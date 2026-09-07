import { ImageResponse } from "next/og";

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
        background: "#0c6b62",
        borderRadius: radius,
      }}
    >
      <svg
        width={mark * 0.62}
        height={mark * 0.62}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z" />
        <path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12" />
        <path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17" />
      </svg>
    </div>,
    { width: size, height: size },
  );
}
