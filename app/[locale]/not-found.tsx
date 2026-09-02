import { Search } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { buttonClasses } from "@/components/ui/Button";
import { Empty } from "@/components/ui/Empty";
import { Link } from "@/lib/i18n/navigation";
import { iconProps } from "@/lib/icons/sizes";

export default async function NotFound() {
  const t = await getTranslations("states.notFound");
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[520px] items-center px-4">
      <Empty
        icon={<Search {...iconProps("lg")} />}
        title={t("title")}
        body={t("body")}
        action={
          <Link href="/home" className={buttonClasses()}>
            {t("cta")}
          </Link>
        }
        className="w-full"
      />
    </main>
  );
}
