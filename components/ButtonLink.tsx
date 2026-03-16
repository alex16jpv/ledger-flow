import Link from "next/link";

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
  bgColor?: string;
  textColor?: string;
  className?: string;
}) {
  const finalBgColor = transparent
    ? "transparent"
    : `bg-${bgColor}-400 hover:bg-${bgColor}-600`;
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
