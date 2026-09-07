"use client";

import { MoreHorizontal, PencilLine } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { AmountInput } from "@/components/ui/AmountInput";
import { Button } from "@/components/ui/Button";
import { CategoryChip, Chip, ChipRow } from "@/components/ui/Chip";
import { Input } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { AccountPicker } from "@/features/accounts/components/AccountPicker";
import { useAccountsQuery } from "@/features/accounts/hooks";
import { CategoryPickerSheet } from "@/features/categories/components/CategoryPickerSheet";
import { useCategoriesQuery, useRecentCategories } from "@/features/categories/hooks";
import { useDeleteTransaction, useQuickAdd } from "@/features/transactions/hooks";
import { draftToSearchParams, quickAddSchema } from "@/features/transactions/schemas";
import { fieldErrors, presentError } from "@/lib/api/errors";
import { IdempotencyKeyring } from "@/lib/api/idempotency";
import { isValidationKey, validationMessage } from "@/lib/i18n/validation";
import { CategoryIcon } from "@/lib/icons/CategoryIcon";
import { iconProps } from "@/lib/icons/sizes";
import type { QuickAddTransactionInput } from "@/types/api";

export const QUICK_RECENT_LIMIT = 5;

interface QuickAddSheetProps {
  open: boolean;
  chain: boolean;
  onClose: () => void;
  onMoreDetails: (params: URLSearchParams) => void;
}

export function QuickAddSheet({ open, chain, onClose, onMoreDetails }: QuickAddSheetProps) {
  const t = useTranslations();
  const toast = useToast();
  const accounts = useAccountsQuery(false, open);
  const categories = useCategoriesQuery("EXPENSE", open);
  const recent = useRecentCategories("EXPENSE", categories.data, QUICK_RECENT_LIMIT, open);
  const quickAdd = useQuickAdd();
  const remove = useDeleteTransaction();

  const [amount, setAmount] = useState<number | null>(null);
  const [amountKey, setAmountKey] = useState(0);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [issues, setIssues] = useState<Record<string, string>>({});
  const keyring = useRef(new IdempotencyKeyring());
  const amountInput = useRef<HTMLInputElement>(null);

  // showModal() lands on the close button; the amount must own the focus on every (re)opening.
  useEffect(() => {
    if (open) amountInput.current?.focus();
  }, [open, amountKey]);

  const defaultAccount = accounts.data?.find((account) => account.isDefault) ?? null;
  const effectiveAccountId = accountId ?? defaultAccount?.id ?? null;
  const selectedCategory = categories.data?.find((category) => category.id === categoryId) ?? null;
  const chips =
    selectedCategory && !recent.some((category) => category.id === selectedCategory.id)
      ? [selectedCategory, ...recent]
      : recent;
  const serverFields = fieldErrors(quickAdd.error);
  const amountError = validationMessage(t, issues.amount ?? serverFields.amount);
  const accountError = validationMessage(t, issues.accountId ?? serverFields.accountId);
  const formError =
    quickAdd.error && Object.keys(serverFields).length === 0 ? presentError(quickAdd.error) : null;

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
    setAccountId(null);
    onClose();
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

  async function save() {
    const parsed = quickAddSchema.safeParse({
      amount,
      categoryId,
      accountId: effectiveAccountId,
      description,
    });
    if (!parsed.success) {
      setIssues(
        Object.fromEntries(
          parsed.error.issues.flatMap((issue) =>
            isValidationKey(issue.message) ? [[String(issue.path[0]), issue.message]] : [],
          ),
        ),
      );
      return;
    }
    setIssues({});
    const input: QuickAddTransactionInput = {
      amount: parsed.data.amount,
      ...(categoryId ? { categoryId } : {}),
      ...(effectiveAccountId ? { fromAccountId: effectiveAccountId } : {}),
    };
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
    onMoreDetails(
      draftToSearchParams({ amount, categoryId, accountId: effectiveAccountId, description }),
    );
    close();
  }

  return (
    <>
      <Sheet
        open={open}
        onClose={close}
        title={t("transactions.quick.title")}
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
          <div className="flex flex-col gap-1">
            <AmountInput
              key={amountKey}
              ref={amountInput}
              label={t("transactions.quick.amount")}
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
                defaultAccount && !accountId
                  ? t("transactions.quick.fromMain")
                  : t("transactions.quick.account")
              }
              value={effectiveAccountId}
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
        type="EXPENSE"
        value={categoryId}
        onSelect={(category) => {
          setCategoryId(category.id);
        }}
      />
    </>
  );
}
