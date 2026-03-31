import Link from "next/link";

const BG_COLOR_CLASSES = {
  teal: "bg-teal-400 hover:bg-teal-600",
  red: "bg-red-400 hover:bg-red-600",
  blue: "bg-blue-400 hover:bg-blue-600",
  amber: "bg-amber-400 hover:bg-amber-600",
  purple: "bg-purple-400 hover:bg-purple-600",
  stone: "bg-stone-400 hover:bg-stone-600",
} as const;

type BgColorKey = keyof typeof BG_COLOR_CLASSES;

export default function ButtonLink({
  icon,
  text,
  link,
  transparent = false,
  bgColor = "teal",
  textColor = "text-white",
  className = "",
}: {
  icon?: string;
  text: string;
  link: string;
  transparent?: boolean;
  bgColor?: BgColorKey;
  textColor?: string;
  className?: string;
}) {
  const finalBgColor = transparent
    ? "transparent"
    : (BG_COLOR_CLASSES[bgColor] ?? BG_COLOR_CLASSES.teal);
  return (
    <Link
      href={link}
      className={`flex items-center gap-1.5 ${finalBgColor} ${textColor} text-sm font-medium rounded-lg px-3.5 py-2 transition-colors ${className}`}
    >
      {icon && <span className="text-base leading-none">{icon}</span>}
      {text}
    </Link>
  );
}
