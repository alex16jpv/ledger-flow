import { Avatar as Drawing, Style } from "@dicebear/core";
import blobs from "@dicebear/styles/blobs.json";
import { User } from "lucide-react";

import { cn } from "@/components/ui/cn";
import { iconProps } from "@/lib/icons/sizes";

export type AvatarSize = "sm" | "md" | "lg";

export interface AvatarProps {
  seed: string | null | undefined;
  size?: AvatarSize;
  className?: string;
}

const SIZE: Record<AvatarSize, string> = {
  sm: "size-6",
  md: "size-9",
  lg: "size-14",
};

let style: Style<typeof blobs> | undefined;
// lazy: a server render meets every user's ids, so the cache starts over past this many.
const MAX_DRAWN = 500;
const drawn = new Map<string, string>();

export function blobOf(seed: string): string {
  const cached = drawn.get(seed);
  if (cached !== undefined) return cached;
  style ??= new Style(blobs);
  const uri = new Drawing(style, { seed }).toDataUri();
  if (drawn.size >= MAX_DRAWN) drawn.clear();
  drawn.set(seed, uri);
  return uri;
}

export function Avatar({ seed, size = "md", className }: AvatarProps) {
  const shape = cn("shrink-0 rounded-full border border-border", SIZE[size], className);
  if (!seed)
    return (
      <span
        aria-hidden="true"
        className={cn("grid place-items-center bg-brand-soft text-brand-text", shape)}
      >
        <User {...iconProps(size === "sm" ? "sm" : "md")} />
      </span>
    );
  // eslint-disable-next-line @next/next/no-img-element -- a data: URI drawn here has nothing for next/image to optimise
  return <img alt="" aria-hidden="true" src={blobOf(seed)} className={shape} />;
}
