import { User } from "lucide-react";

import { cn } from "@/components/ui/cn";
import { iconProps } from "@/lib/icons/sizes";
import { type ColorToken, featureColorStyle, isColorToken } from "@/lib/theme/feature-color";

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return `${first}${last}`.toUpperCase();
}

export type AvatarSize = "sm" | "md" | "lg";

export interface AvatarProps {
  name: string;
  size?: AvatarSize;
  // A person carries their own colour; the signed-in user wears the brand's.
  color?: ColorToken | null;
  className?: string;
}

const SIZE: Record<AvatarSize, string> = {
  sm: "size-7 text-xs",
  md: "size-9 text-sm",
  lg: "size-16 text-xl",
};

export function Avatar({ name, size = "md", color, className }: AvatarProps) {
  const own = isColorToken(color);
  return (
    <span
      aria-hidden="true"
      style={featureColorStyle(color)}
      className={cn(
        "grid shrink-0 place-items-center rounded-full border font-semibold",
        own
          ? "border-(--f-border) bg-(--f-soft) text-(--f-text)"
          : "border-border bg-brand-soft text-brand-text",
        SIZE[size],
        className,
      )}
    >
      {/* F-82: a device with no name yet shows the icon, never two empty initials. */}
      {initialsOf(name) || <User {...iconProps(size === "sm" ? "sm" : "md")} />}
    </span>
  );
}
