import { Search } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { PublicFrame } from "@/components/public/PublicFrame";
import { buttonClasses } from "@/components/ui/Button";
import { Empty } from "@/components/ui/Empty";
import { Link } from "@/lib/i18n/navigation";
import { iconProps } from "@/lib/icons/sizes";

export default async function NotFound() {
  const t = await getTranslations("public.notFound");
  return (
    <PublicFrame>
      <div className="mx-auto flex w-full max-w-[520px] items-center px-4 py-16">
        <Empty
          icon={<Search {...iconProps("lg")} />}
          title={t("title")}
          body={t("body")}
          action={
            <Link href="/home" className={buttonClasses()}>
              {t("home")}
            </Link>
          }
          className="w-full"
        />
      </div>
    </PublicFrame>
  );
}
