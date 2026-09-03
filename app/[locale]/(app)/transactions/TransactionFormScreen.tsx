"use client";

import { CircleAlert, Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/Button";
import { Empty } from "@/components/ui/Empty";
import { LoadErrorBody } from "@/components/ui/LoadErrorBody";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { DeleteTransactionSheet } from "@/features/transactions/components/DeleteTransactionSheet";
import {
  defaultFormValues,
  draftFromSearchParams,
  fromTransaction,
  type TransactionFormValues,
} from "@/features/transactions/form";
import {
  useCreateTransaction,
  useDeleteTransaction,
  useTransactionQuery,
  useUpdateTransaction,
} from "@/features/transactions/hooks";
import { ApiError, presentError } from "@/lib/api/errors";
import { useFormatSettings } from "@/lib/i18n/FormatSettingsProvider";
import { useRouter } from "@/lib/i18n/navigation";
import { iconProps } from "@/lib/icons/sizes";
import { useBackNavigation } from "@/lib/navigation/history";

import { TransactionForm } from "./TransactionForm";

const AFTER_SAVE_PATH = "/transactions";

export function NewTransactionScreen() {
  const t = useTranslations();
  const router = useRouter();
  const back = useBackNavigation();
  const toast = useToast();
  const params = useSearchParams();
  const { timeZone } = useFormatSettings();
  const create = useCreateTransaction();
  const [defaults] = useState<TransactionFormValues>(() => {
    const draft = draftFromSearchParams(new URLSearchParams(params.toString()));
    return {
      ...defaultFormValues(new Date(), timeZone),
      ...(draft.amount !== undefined ? { amount: draft.amount } : {}),
      categoryId: draft.categoryId ?? null,
      accountId: draft.accountId ?? null,
      description: draft.description ?? "",
    };
  });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("transactions.form.newTitle")}
        onBack={() => {
          back(AFTER_SAVE_PATH);
        }}
      />
      <TransactionForm
        defaultValues={defaults}
        submitLabel={t("transactions.form.save")}
        pending={create.isPending}
        error={create.error}
        onSubmit={async (input, idempotencyKey) => {
          await create.mutateAsync({ input, idempotencyKey });
          toast.show({ message: t("transactions.form.saved") });
          router.push(AFTER_SAVE_PATH);
        }}
      />
    </div>
  );
}

export function EditTransactionScreen({ id }: { id: string }) {
  const t = useTranslations();
  const router = useRouter();
  const back = useBackNavigation();
  const toast = useToast();
  const { timeZone } = useFormatSettings();
  const transaction = useTransactionQuery(id);
  const update = useUpdateTransaction(id);
  const remove = useDeleteTransaction();
  const [confirming, setConfirming] = useState(false);
  const notFound = transaction.error instanceof ApiError && transaction.error.status === 404;

  async function confirmDelete() {
    try {
      await remove.mutateAsync(id);
      toast.show({ message: t("transactions.form.deleted") });
      router.push(AFTER_SAVE_PATH);
    } catch (error) {
      toast.show({ message: t(presentError(error).messageKey), tone: "danger" });
      setConfirming(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("transactions.form.editTitle")}
        onBack={() => {
          back(`/transactions/${id}`);
        }}
      />
      {transaction.isPending ? (
        <div className="flex flex-col gap-4" aria-busy="true" aria-label={t("common.loading")}>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="mx-auto h-16 w-48" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : transaction.isError ? (
        <Empty
          tone={notFound ? "neutral" : "danger"}
          icon={<CircleAlert {...iconProps("lg")} />}
          title={notFound ? t("transactions.form.notFound") : t("states.error.title")}
          body={notFound ? undefined : <LoadErrorBody error={transaction.error} />}
          action={
            notFound ? undefined : (
              <Button
                onClick={() => {
                  void transaction.refetch();
                }}
              >
                {t("common.retry")}
              </Button>
            )
          }
        />
      ) : (
        <TransactionForm
          defaultValues={fromTransaction(transaction.data, timeZone)}
          submitLabel={t("common.saveChanges")}
          pending={update.isPending}
          error={update.error}
          onSubmit={async (input) => {
            await update.mutateAsync(input);
            toast.show({ message: t("transactions.form.updated") });
            router.push(AFTER_SAVE_PATH);
          }}
          secondaryAction={
            <Button
              type="button"
              variant="danger"
              size="lg"
              block
              onClick={() => {
                setConfirming(true);
              }}
            >
              <Trash2 {...iconProps("sm")} />
              {t("common.delete")}
            </Button>
          }
        />
      )}
      <DeleteTransactionSheet
        open={confirming}
        pending={remove.isPending}
        onConfirm={() => {
          void confirmDelete();
        }}
        onClose={() => {
          setConfirming(false);
        }}
      />
    </div>
  );
}
