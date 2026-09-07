"use client";

import { useEffect } from "react";

import { isMode, isPalette, useTheme } from "@/lib/theme";

interface DevFrameProps {
  src: string;
  width: number;
  height: number;
  mode?: string;
  palette?: string;
}

// Presets the shared theme storage before the framed app loads, so screenshots can pick light or dark.
export function DevFrame({ src, width, height, mode, palette }: DevFrameProps) {
  const theme = useTheme();
  const { setMode, setPalette } = theme;
  const ready =
    (!isMode(mode) || theme.mode === mode) && (!isPalette(palette) || theme.palette === palette);

  useEffect(() => {
    if (isMode(mode)) setMode(mode);
    if (isPalette(palette)) setPalette(palette);
  }, [mode, palette, setMode, setPalette]);

  if (!ready)
    return <div style={{ width, height }} className="border border-border-strong bg-bg" />;
  return (
    <iframe
      title={src}
      src={src}
      width={width}
      height={height}
      className="border border-border-strong bg-bg"
    />
  );
}
