"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import AmountInput from "@/components/forms/AmountInput";
import LivePreview, { SaveButton } from "./LivePreview";
import TransactionForm from "./TransactionForm";
import TransactionTypeSelector from "./TypeSelector";
import { TRANSACTION_TYPES, DEFAULT_LIST_LIMIT } from "@/utils/constants";
import {
  transactionSchema,
  TransactionFormFields,
} from "@/lib/schemas/transaction.schema";
import { TransactionKind } from "@/types/Transaction.types";
import { getCurrentDateTime, parseDateTimeFields } from "@/lib/dates";
import { createTransaction } from "@/services/transactions.service";
import { getCategories } from "@/services/categories.service";
import { getAccounts } from "@/services/accounts.service";
import { Category } from "@/types/Category.types";

// Cast needed: transactionSchema is a discriminated union, but the form uses a flat type
// with all variant-specific fields optional.
const transactionResolver = zodResolver(
  transactionSchema,
) as Resolver<TransactionFormFields>;

const DEFAULT_VALUES: Partial<TransactionFormFields> & {
  type: TransactionFormFields["type"];
} = {
  type: TRANSACTION_TYPES.EXPENSE,
  description: "",
  date: "",
  time: "",
  categoryId: "",
  fromAccountId: "",
  toAccountId: "",
  payer: "",
  tags: "",
  note: "",
};

export default function NewTransactionContainer() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [accountOptions, setAccountOptions] = useState<
    { value: string; label: string }[]
  >([]);

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    watch,
    clearErrors,
    control,
    formState: { errors, isSubmitting },
  } = useForm<TransactionFormFields>({
    resolver: transactionResolver,
    defaultValues: DEFAULT_VALUES,
  });

  const selectedType = watch("type");
  const selectedCategoryId = watch("categoryId");

  // Set date/time on mount (client-only) to avoid hydration mismatch
  useEffect(() => {
    const { date, time } = getCurrentDateTime();
    setValue("date", date);
    setValue("time", time);
  }, [setValue]);

  // Fetch all categories and accounts once (localStorage cache prevents redundant requests)
  useEffect(() => {
    getCategories({ limit: DEFAULT_LIST_LIMIT }).then((res) => {
      if (res.data?.data) setAllCategories(res.data.data);
    });
    getAccounts({ limit: DEFAULT_LIST_LIMIT }).then((res) => {
      if (res.data?.data) {
        setAccountOptions(
          res.data.data.map((a) => ({ value: a.id, label: a.name })),
        );
      }
    });
  }, []);

  // Client-side filtering: derive categories by selected transaction type
  const categories = useMemo(
    () => allCategories.filter((c) => c.type === selectedType),
    [allCategories, selectedType],
  );

  const onCategoryChange = (id: string) => {
    setValue("categoryId", id, { shouldValidate: true });
  };

  const setSelectedType = (type: TransactionKind) => {
    const { date, time } = getCurrentDateTime();
    setValue("type", type);
    setValue("date", date);
    setValue("time", time);
    setValue("categoryId", "");
    setValue("fromAccountId", "");
    setValue("toAccountId", "");
    setValue("payer", "");
    clearErrors();
  };

  const onSwapAccounts = () => {
    const from = getValues("fromAccountId");
    const to = getValues("toAccountId");
    setValue("fromAccountId", to);
    setValue("toAccountId", from);
  };

  const onSubmit = async (data: TransactionFormFields) => {
    setServerError(null);
    const { time, date, categoryId, payer: _payer, ...rest } = data;
    const isoDate = parseDateTimeFields(date, time).toISOString();
    const result = await createTransaction({
      ...rest,
      date: isoDate,
      categoryId: categoryId || null,
    });

    if (result.error) {
      setServerError(result.error);
      return;
    }

    router.push("/transactions");
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="contents">
      <div className="lg:col-span-3 flex flex-col gap-5">
        {serverError && (
          <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3">
            {serverError}
          </div>
        )}

        <section className="bg-white border border-stone-100 rounded-xl p-6">
          <TransactionTypeSelector
            selectedType={selectedType}
            onTypeChange={setSelectedType}
          />
          <AmountInput control={control} error={errors.amount?.message} />
        </section>

        <TransactionForm
          selectedType={selectedType}
          register={register}
          errors={errors}
          accountOptions={accountOptions}
          categories={categories}
          selectedCategoryId={selectedCategoryId}
          onCategoryChange={onCategoryChange}
          onSwapAccounts={onSwapAccounts}
        />

        <div className="lg:hidden">
          <SaveButton selectedType={selectedType} isSubmitting={isSubmitting} />
        </div>
      </div>

      <LivePreview
        selectedType={selectedType}
        control={control}
        isSubmitting={isSubmitting}
        accountOptions={accountOptions}
      />
    </form>
  );
}
