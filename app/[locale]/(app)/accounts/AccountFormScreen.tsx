"use client";

import { CircleAlert } from "lucide-react";
import { useTranslations } from "next-intl";

import { PageHeader } from "@/components/shell/PageHeader";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Empty } from "@/components/ui/Empty";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { AccountForm } from "@/features/accounts/components/AccountForm";
import { useAccountQuery } from "@/features/accounts/hooks";
import { ApiError } from "@/lib/api/errors";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { iconProps } from "@/lib/icons/sizes";

const LIST_PATH = "/accounts";

export function NewAccountScreen() {
  const t = useTranslations();
  const router = useRouter();
  const toast = useToast();
  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-5">
      <PageHeader
        title={t("accounts.form.title")}
        onBack={() => {
          router.back();
        }}
      />
      <AccountForm
        submitLabel={t("accounts.form.create")}
        onSaved={(account) => {
          toast.show({ message: t("accounts.form.created") });
          router.push(`/accounts/${account.id}`);
        }}
      />
    </div>
  );
}

export function EditAccountScreen({ id }: { id: string }) {
  const t = useTranslations();
  const router = useRouter();
  const toast = useToast();
  const account = useAccountQuery(id);
  const notFound = account.error instanceof ApiError && account.error.status === 404;

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-5">
      <PageHeader
        title={t("accounts.form.editTitle")}
        onBack={() => {
          router.back();
        }}
      />
      {account.isPending ? (
        <div className="flex flex-col gap-4" aria-busy="true" aria-label={t("common.loading")}>
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : account.isError ? (
        <Empty
          tone={notFound ? "neutral" : "danger"}
          icon={<CircleAlert {...iconProps("lg")} />}
          title={notFound ? t("accounts.detail.notFound") : t("states.error.title")}
          body={notFound ? undefined : t("states.error.body")}
          action={
            notFound ? (
              <Link href={LIST_PATH} className={buttonClasses({ variant: "secondary" })}>
                {t("common.backToList")}
              </Link>
            ) : (
              <Button
                onClick={() => {
                  void account.refetch();
                }}
              >
                {t("common.retry")}
              </Button>
            )
          }
        />
      ) : account.data.archivedAt ? (
        <Empty
          icon={<CircleAlert {...iconProps("lg")} />}
          title={t("errors.RESOURCE_ARCHIVED")}
          body={t("accounts.detail.archivedInfo")}
          action={
            <Link href={`/accounts/${id}`} className={buttonClasses({ variant: "secondary" })}>
              {t("common.back")}
            </Link>
          }
        />
      ) : (
        <AccountForm
          account={account.data}
          submitLabel={t("common.saveChanges")}
          onSaved={() => {
            toast.show({ message: t("accounts.form.saved") });
            router.push(`/accounts/${id}`);
          }}
        />
      )}
    </div>
  );
}
