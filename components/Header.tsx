import ButtonLink from "./ButtonLink";

export default function Header({
  title,
  subTitle,
}: {
  title: string;
  subTitle?: string;
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

      {/* <!-- Right actions --> */}
      <div className="flex items-center gap-2">
        {/* <button
          aria-label="Notificaciones"
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-stone-100 bg-stone-50 hover:bg-stone-100 transition-colors text-sm"
        >
          🔔
        </button> */}
        <ButtonLink
          icon="＋"
          text="New Transaction"
          link="/new-transaction"
          color="teal"
        />
      </div>
    </header>
  );
}
