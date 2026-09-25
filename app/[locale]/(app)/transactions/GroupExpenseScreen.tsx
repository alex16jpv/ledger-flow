"use client";

import { Archive, Users } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { PageHeader } from "@/components/shell/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Empty } from "@/components/ui/Empty";
import { LoadErrorBody } from "@/components/ui/LoadErrorBody";
import { List } from "@/components/ui/Row";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { useAccountsQuery } from "@/features/accounts/hooks";
import { useCategoriesQuery } from "@/features/categories/hooks";
import { useCreateSharedExpense, useSharedSection } from "@/features/shared/hooks";
import { type GroupView, groupView } from "@/features/shared/ledger";
import { expenseFromTransaction } from "@/features/shared/write";
import { TransactionRow } from "@/features/transactions/components/TransactionRow";
import {
  defaultFormValues,
  draftFromSearchParams,
  draftToFormValues,
  type TransactionFormValues,
} from "@/features/transactions/form";
import { useCreateTransaction } from "@/features/transactions/hooks";
import { presentError } from "@/lib/api/errors";
import { type FormatSettings, useFormatSettings } from "@/lib/i18n/FormatSettingsProvider";
import { useRouter } from "@/lib/i18n/navigation";
import { iconProps } from "@/lib/icons/sizes";
import { newEntityId } from "@/lib/local/outbox/envelope";
import { useBackNavigation } from "@/lib/navigation/history";
import type { Transaction } from "@/types/api";

import { TransactionForm } from "./TransactionForm";

function startingValues(params: URLSearchParams, settings: FormatSettings): TransactionFormValues {
  const base = draftToFormValues(
    draftFromSearchParams(params),
    defaultFormValues(new Date(), settings.timeZone),
  );
  return { ...base, type: "EXPENSE" };
}

// Read, not a way anywhere: it is the same row the list draws, badge for a movement still queued included.
function SavedMovement({ transaction }: { transaction: Transaction }) {
  const accounts = useAccountsQuery();
  const categories = useCategoriesQuery();
  return (
    <Card flush>
      <List>
        <TransactionRow
          transaction={transaction}
          lookups={{
            accounts: new Map((accounts.data ?? []).map((row) => [row.id, row])),
            categories: new Map((categories.data ?? []).map((row) => [row.id, row])),
          }}
        />
      </List>
    </Card>
  );
}

interface Alone {
  transaction: Transaction;
  error: unknown;
}

function GroupExpenseBody({ view }: { view: GroupView }) {
  const t = useTranslations();
  const router = useRouter();
  const toast = useToast();
  const settings = useFormatSettings();
  const create = useCreateTransaction();
  const createExpense = useCreateSharedExpense();
  const params = useSearchParams();
  const [defaults] = useState<TransactionFormValues>(() =>
    startingValues(new URLSearchParams(params.toString()), settings),
  );
  // The movement is written first because it is the money, so a refusal leaves it saved and alone.
  const [alone, setAlone] = useState<Alone | null>(null);
  // Minted once: a second try must finish the expense it started, never open another one.
  const [expenseId] = useState(newEntityId);
  const group = view.group;
  const groupPath = `/shared/groups/${group.id}`;

  async function attach(transaction: Transaction) {
    try {
      await createExpense.mutateAsync(expenseFromTransaction(group, transaction, expenseId));
    } catch (error) {
      setAlone({ transaction, error });
      return;
    }
    toast.show({ message: t("transactions.form.inGroup.saved", { name: group.name }) });
    router.replace(groupPath);
  }

  if (alone) {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="danger" title={t("transactions.form.inGroup.halfSaved.title")}>
          {t(presentError(alone.error).messageKey)}
        </Alert>
        <SavedMovement transaction={alone.transaction} />
        <div className="flex flex-col gap-2">
          <Button
            size="lg"
            block
            loading={createExpense.isPending}
            onClick={() => {
              void attach(alone.transaction);
            }}
          >
            {t("transactions.form.inGroup.halfSaved.retry")}
          </Button>
          <Button
            variant="secondary"
            size="lg"
            block
            onClick={() => {
              router.replace(groupPath);
            }}
          >
            {t("transactions.form.inGroup.halfSaved.open", { name: group.name })}
          </Button>
        </div>
        <p className="text-xs text-text-3">{t("transactions.form.inGroup.halfSaved.note")}</p>
      </div>
    );
  }

  return (
    <TransactionForm
      suggest={false}
      defaultValues={defaults}
      fixedType
      notice={
        <Alert tone="neutral" icon={Users}>
          {t(`transactions.form.inGroup.notice.${group.defaultSplit.mode}`, {
            name: group.name,
            count: group.participants.length,
          })}{" "}
          {t("shared.form.nothingChanges")}
        </Alert>
      }
      submitLabel={t("transactions.form.inGroup.save")}
      pending={create.isPending || createExpense.isPending}
      error={create.error}
      onSubmit={async (input, idempotencyKey) => {
        await attach(await create.mutateAsync({ input, idempotencyKey }));
      }}
    />
  );
}

export function GroupExpenseScreen({ groupId }: { groupId: string }) {
  const t = useTranslations();
  const router = useRouter();
  const back = useBackNavigation();
  const { section, isPending, isError, error, refetch } = useSharedSection();
  const { profileResolved } = useFormatSettings();
  const view = section && groupView(section, groupId);
  const groupPath = `/shared/groups/${groupId}`;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("transactions.form.newTitle")}
        onBack={() => {
          back(groupPath);
        }}
      />
      {isPending || !profileResolved ? (
        <div
          className="flex flex-col gap-4"
          role="status"
          aria-busy="true"
          aria-label={t("common.loading")}
        >
          <Skeleton className="h-14 w-full" />
          <Skeleton className="mx-auto h-16 w-48" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : isError || !view ? (
        <Empty
          tone="danger"
          icon={<Users {...iconProps("lg")} />}
          title={isError ? t("states.error.title") : t("shared.group.missing.title")}
          body={isError ? <LoadErrorBody error={error} /> : t("shared.group.missing.body")}
          action={
            isError ? (
              <Button onClick={refetch}>{t("common.retry")}</Button>
            ) : (
              <Button
                variant="secondary"
                onClick={() => {
                  router.replace("/shared");
                }}
              >
                {t("transactions.form.inGroup.back")}
              </Button>
            )
          }
        />
      ) : view.group.archivedAt !== null ? (
        <Empty
          icon={<Archive {...iconProps("lg")} />}
          title={t("transactions.form.inGroup.archived.title", { name: view.group.name })}
          body={t("transactions.form.inGroup.archived.body")}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  router.replace(groupPath);
                }}
              >
                {t("transactions.form.inGroup.archived.open")}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  router.replace("/shared");
                }}
              >
                {t("transactions.form.inGroup.back")}
              </Button>
            </div>
          }
        />
      ) : (
        <GroupExpenseBody view={view} />
      )}
    </div>
  );
}
