export default function TypeSelectorButton({
  isSelected,
  onClick,
  children,
  className = "",
}: {
  isSelected: boolean;
  onClick: (e: any) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-[10px] border-[1.5px] px-2 py-2.5 font-mono text-xs font-medium cursor-pointer transition-all duration-150 hover:border-stone-400 hover:text-stone-800 ${className ? className : "border-stone-100 bg-white text-stone-400"}`}
      role="tab"
      aria-selected={isSelected}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
