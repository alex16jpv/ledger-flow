export default function Header({
  title,
  subTitle,
  children,
}: {
  title: string;
  subTitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 bg-white border-b border-stone-100 px-5 lg:px-8 py-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="font-display font-medium text-lg text-stone-900">
            {title}
          </h1>
          {subTitle && (
            <p className="hidden sm:block font-mono text-[11px] text-stone-400 -mt-0.5">
              {subTitle}
            </p>
          )}
        </div>
      </div>

      {children && <div className="flex items-center gap-2">{children}</div>}
    </header>
  );
}
