import Link from "next/link";

export default function ButtonLink({
  icon,
  text,
  link,
  color = "teal",
  className = "",
}: {
  icon?: string;
  text: string;
  link: string;
  color?: string;
  className?: string;
}) {
  return (
    <Link
      href={link}
      className={`flex items-center gap-1.5 bg-${color}-400 hover:bg-${color}-600 text-white text-sm font-medium rounded-lg px-3.5 py-2 transition-colors ${className}`}
    >
      {icon && <span className="text-base leading-none">{icon}</span>}
      {text}
    </Link>
  );
}
