"use client";

import { ArrowUpDown, MoreHorizontal, PencilLine } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { AmountInput } from "@/components/ui/AmountInput";
import { Button } from "@/components/ui/Button";
import { CategoryChip, Chip, ChipRow } from "@/components/ui/Chip";
import { Input } from "@/components/ui/Field";
import { Segment, type SegmentOption } from "@/components/ui/Segment";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { AccountPicker } from "@/features/accounts/components/AccountPicker";
import { useAccountsQuery } from "@/features/accounts/hooks";
import { CategoryPickerSheet } from "@/features/categories/components/CategoryPickerSheet";
import { useCategoriesQuery, useRecentCategories } from "@/features/categories/hooks";
import { TypeLine } from "@/features/transactions/components/TypeLine";
import { useDeleteTransaction, useQuickAdd } from "@/features/transactions/hooks";
import {
  draftToSearchParams,
  QUICK_TYPES,
  quickAddInput,
  quickAddSchema,
  type QuickAddType,
} from "@/features/transactions/schemas";
import { INCOME_REFUSED_TYPES } from "@/lib/accounts/debt";
import { fieldErrors, presentError } from "@/lib/api/errors";
import { IdempotencyKeyring } from "@/lib/api/idempotency";
import { isValidationKey, validationMessage } from "@/lib/i18n/validation";
import { CategoryIcon } from "@/lib/icons/CategoryIcon";
import { iconProps } from "@/lib/icons/sizes";

export const QUICK_RECENT_LIMIT = 5;

const TYPE_TONE = { EXPENSE: "default", INCOME: "income", TRANSFER: "transfer" } as const;

interface QuickAddSheetProps {
  open: boolean;
  chain: boolean;
  onClose: () => void;
  onMoreDetails: (params: URLSearchParams) => void;
}

export function QuickAddSheet({ open, chain, onClose, onMoreDetails }: QuickAddSheetProps) {
  const t = useTranslations();
  const toast = useToast();
  const [type, setType] = useState<QuickAddType>("EXPENSE");
  const transfer = type === "TRANSFER";
  const accounts = useAccountsQuery(false, open);
  const categories = useCategoriesQuery(type, open);
  const recent = useRecentCategories(type, categories.data, QUICK_RECENT_LIMIT, open);
  const quickAdd = useQuickAdd();
  const remove = useDeleteTransaction();

  const [amount, setAmount] = useState<number | null>(null);
  const [amountKey, setAmountKey] = useState(0);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [toAccountId, setToAccountId] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [issues, setIssues] = useState<Record<string, string>>({});
  const keyring = useRef(new IdempotencyKeyring());
  const amountInput = useRef<HTMLInputElement>(null);

  // showModal() lands on the bar that opens the full form; the amount owns the focus instead.
  useEffect(() => {
    if (open) amountInput.current?.focus();
  }, [open, amountKey]);

  const defaultAccount = accounts.data?.find((account) => account.isDefault) ?? null;
  const income = type === "INCOME";
  const isDebt = (id: string | null): boolean => {
    const account = accounts.data?.find((row) => row.id === id);
    return account !== undefined && INCOME_REFUSED_TYPES.has(account.type);
  };
  const mainIsDebt = income && isDebt(defaultAccount?.id ?? null);
  const effectiveAccountId = accountId ?? (mainIsDebt ? null : (defaultAccount?.id ?? null));
  const selectedCategory = categories.data?.find((category) => category.id === categoryId) ?? null;
  const chips =
    selectedCategory && !recent.some((category) => category.id === selectedCategory.id)
      ? [selectedCategory, ...recent]
      : recent;
  const serverFields = fieldErrors(quickAdd.error);
  const amountError = validationMessage(t, issues.amount ?? serverFields.amount);
  const oneAccount = transfer
    ? undefined
    : (serverFields.accountId ?? serverFields.fromAccountId ?? serverFields.toAccountId);
  const accountError = validationMessage(t, issues.accountId ?? oneAccount);
  const toAccountError = transfer
    ? validationMessage(t, issues.toAccountId ?? serverFields.toAccountId)
    : undefined;
  const formError =
    quickAdd.error && Object.keys(serverFields).length === 0 ? presentError(quickAdd.error) : null;
  const typeOptions: SegmentOption<QuickAddType>[] = QUICK_TYPES.map((value) => ({
    value,
    label: t(`transactionTypes.${value}`),
    tone: TYPE_TONE[value],
  }));

  function resetEntry() {
    setAmount(null);
    setAmountKey((key) => key + 1);
    setCategoryId(null);
    setDescription("");
    setIssues({});
    quickAdd.reset();
    keyring.current = new IdempotencyKeyring();
  }

  function close() {
    resetEntry();
    setType("EXPENSE");
    setAccountId(null);
    setToAccountId(null);
    onClose();
  }

  function changeType(next: QuickAddType) {
    if (next === type) return;
    setType(next);
    setCategoryId(null);
    if (next === "INCOME" && isDebt(accountId)) setAccountId(null);
    setIssues({});
    quickAdd.reset();
  }

  function undo(id: string) {
    remove
      .mutateAsync(id)
      .then(() => {
        toast.show({ message: t("transactions.quick.undone") });
      })
      .catch(() => {
        toast.show({ message: t("transactions.quick.undoFailed"), tone: "danger" });
      });
  }

  function draft() {
    return {
      type,
      amount,
      categoryId,
      accountId: effectiveAccountId,
      toAccountId,
      description,
    };
  }

  async function save() {
    const parsed = quickAddSchema.safeParse(draft());
    // The schema takes a missing account (the server resolves the main one), but not when that one is a card.
    const missingAccount: Record<string, string> =
      income && effectiveAccountId === null && mainIsDebt
        ? { accountId: "validation.required" }
        : {};
    if (!parsed.success || Object.keys(missingAccount).length > 0) {
      setIssues({
        ...(parsed.success
          ? {}
          : Object.fromEntries(
              parsed.error.issues.flatMap((issue) =>
                isValidationKey(issue.message) ? [[String(issue.path[0]), issue.message]] : [],
              ),
            )),
        ...missingAccount,
      });
      return;
    }
    setIssues({});
    const input = quickAddInput(parsed.data);
    try {
      const result = await quickAdd.mutateAsync({
        input,
        description: parsed.data.description || null,
        idempotencyKey: keyring.current.keyFor(input),
      });
      toast.show({
        message: result.detailsSaved
          ? t("transactions.quick.saved")
          : t("transactions.quick.savedWithoutNote"),
        tone: result.detailsSaved ? "default" : "danger",
        action: {
          label: t("common.undo"),
          onClick: () => {
            undo(result.transaction.id);
          },
        },
      });
      if (chain) resetEntry();
      else close();
    } catch {
      return;
    }
  }

  function moreDetails() {
    onMoreDetails(draftToSearchParams(draft()));
    close();
  }

  return (
    <>
      <Sheet
        open={open}
        onClose={close}
        unsaved={
          amount !== null ||
          categoryId !== null ||
          accountId !== null ||
          toAccountId !== null ||
          description !== ""
        }
        title={t("transactions.quick.title")}
        onExpand={moreDetails}
        expandLabel={t("transactions.quick.expand")}
        footer={
          <div className="flex gap-3">
            <Button variant="ghost" size="lg" className="flex-1" onClick={moreDetails}>
              {t("transactions.quick.moreDetails")}
            </Button>
            <Button
              size="lg"
              className="flex-1"
              loading={quickAdd.isPending}
              onClick={() => {
                void save();
              }}
            >
              {t("transactions.quick.save")}
            </Button>
          </div>
        }
      >
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          {formError && <Alert tone="danger">{t(formError.messageKey)}</Alert>}
          <Segment
            options={typeOptions}
            value={type}
            onChange={changeType}
            label={t("transactions.form.type")}
          />
          <TypeLine type={type} />
          <div className="flex flex-col gap-1">
            <AmountInput
              key={amountKey}
              ref={amountInput}
              label={t("transactions.quick.amount")}
              tone={TYPE_TONE[type]}
              onChange={setAmount}
              invalid={Boolean(amountError) || (amount !== null && Number.isNaN(amount))}
              className="py-3"
            />
            {amountError && (
              <span role="alert" className="text-center text-sm text-danger">
                {amountError}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium text-text-2">{t("transactions.quick.category")}</span>
              <span className="text-text-3">{t("transactions.quick.categoryHint")}</span>
            </div>
            <ChipRow role="group" aria-label={t("transactions.quick.category")}>
              {chips.map((category) => (
                <CategoryChip
                  key={category.id}
                  color={category.color}
                  selected={category.id === categoryId}
                  icon={<CategoryIcon icon={category.icon} size="sm" />}
                  onClick={() => {
                    setCategoryId(category.id === categoryId ? null : category.id);
                  }}
                >
                  {category.name}
                </CategoryChip>
              ))}
              <Chip
                icon={<MoreHorizontal {...iconProps("sm")} />}
                aria-haspopup="dialog"
                onClick={() => {
                  setPickerOpen(true);
                }}
              >
                {t("common.more")}
              </Chip>
            </ChipRow>
          </div>
          <div className="flex flex-col gap-1">
            <AccountPicker
              label={
                transfer
                  ? t("transactions.form.from")
                  : effectiveAccountId !== null && !accountId
                    ? t(
                        type === "INCOME"
                          ? "transactions.quick.intoMain"
                          : "transactions.quick.fromMain",
                      )
                    : t("transactions.quick.account")
              }
              value={effectiveAccountId}
              exclude={transfer ? toAccountId : undefined}
              omit={income ? INCOME_REFUSED_TYPES : undefined}
              note={income ? t("accounts.picker.incomeNote") : undefined}
              onChange={(account) => {
                setAccountId(account.id);
              }}
            />
            {accountError && (
              <span role="alert" className="text-sm text-danger">
                {accountError}
              </span>
            )}
          </div>
          {transfer && (
            <>
              <div className="flex justify-center">
                <Button
                  variant="secondary"
                  size="sm"
                  iconOnly
                  round
                  disabled={toAccountId === null}
                  aria-label={t("transactions.form.swap")}
                  onClick={() => {
                    setAccountId(toAccountId);
                    setToAccountId(effectiveAccountId);
                  }}
                >
                  <ArrowUpDown {...iconProps("sm")} />
                </Button>
              </div>
              <div className="flex flex-col gap-1">
                <AccountPicker
                  label={t("transactions.form.to")}
                  value={toAccountId}
                  exclude={effectiveAccountId}
                  onChange={(account) => {
                    setToAccountId(account.id);
                  }}
                />
                {toAccountError && (
                  <span role="alert" className="text-sm text-danger">
                    {toAccountError}
                  </span>
                )}
              </div>
            </>
          )}
          <Input
            value={description}
            onChange={(event) => {
              setDescription(event.target.value);
            }}
            placeholder={t("transactions.quick.note")}
            aria-label={t("transactions.quick.note")}
            autoComplete="off"
            maxLength={255}
            leading={<PencilLine {...iconProps("sm")} />}
          />
        </form>
      </Sheet>
      <CategoryPickerSheet
        open={pickerOpen}
        onClose={() => {
          setPickerOpen(false);
        }}
        type={type}
        value={categoryId}
        allowCreate={!transfer}
        onSelect={(category) => {
          setCategoryId(category.id);
        }}
      />
    </>
  );
}
