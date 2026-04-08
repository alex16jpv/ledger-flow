"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm, Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import AmountInput from "../../../new/components/AmountInput";
import LivePreview, { SaveButton } from "../../../new/components/LivePreview";
import TransactionForm from "../../../new/components/TransactionForm";
import TransactionTypeSelector from "../../../new/components/TypeSelector";
import {
  transactionSchema,
  TransactionFormFields,
} from "@/lib/schemas/transaction.schema";
import { TransactionKind } from "@/types/Transaction.types";
import { DEFAULT_LIST_LIMIT } from "@/utils/constants";
import { getCurrentDateTime, parseDateTimeFields, formatDate, formatTime } from "@/lib/dates";
import { getAccounts } from "@/services/accounts.service";
import { getCategories } from "@/services/categories.service";
import {
  getTransaction,
  updateTransaction,
} from "@/services/transactions.service";
import { Category } from "@/types/Category.types";

// Cast needed: transactionSchema is a discriminated union, but the form uses a flat type
// with all variant-specific fields optional.
const transactionResolver = zodResolver(transactionSchema) as Resolver<TransactionFormFields>;

export default function EditTransactionContainer({ id }: { id: string }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [accountOptions, setAccountOptions] = useState<
    { value: string; label: string }[]
  >([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    clearErrors,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<TransactionFormFields>({
    resolver: transactionResolver,
  });

  const selectedType = watch("type");
  const selectedCategoryId = watch("categoryId");

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

  const fetchData = useCallback(async (signal: { cancelled: boolean }) => {
    setIsLoading(true);
    setFetchError(null);

    const [transactionResult, accountResult] = await Promise.all([
      getTransaction(id),
      getAccounts(),
    ]);
    if (signal.cancelled) return;

    if (accountResult.data?.data) {
      setAccountOptions(
        accountResult.data.data.map((account) => ({ value: account.id, label: account.name })),
      );
    }
    // Categories will be fetched reactively by the selectedType effect below

    if (transactionResult.error || !transactionResult.data) {
      setFetchError(transactionResult.error ?? "Transaction not found");
      setIsLoading(false);
      return;
    }

    const existingTransaction = transactionResult.data;
    const txDate = existingTransaction.date ? formatDate(existingTransaction.date, "iso") : getCurrentDateTime().date;
    const txTime = existingTransaction.date ? formatTime(existingTransaction.date) : getCurrentDateTime().time;

    reset({
      type: existingTransaction.type,
      amount: existingTransaction.amount,
      description: existingTransaction.description ?? "",
      date: txDate,
      time: txTime,
      categoryId: existingTransaction.categoryId ?? "",
      fromAccountId: existingTransaction.fromAccountId ?? "",
      toAccountId: existingTransaction.toAccountId ?? "",
      tags: existingTransaction.tags ?? "",
      note: existingTransaction.note ?? "",
      payer: "",
    });

    setIsLoading(false);
  }, [id, reset]);

  useEffect(() => {
    const signal = { cancelled: false };
    fetchData(signal);
    return () => { signal.cancelled = true; };
  }, [fetchData]);

  // Re-fetch categories filtered by transaction type
  useEffect(() => {
    if (!selectedType) return;
    let cancelled = false;
    getCategories({ type: selectedType, limit: DEFAULT_LIST_LIMIT }).then((result) => {
      if (cancelled) return;
      if (result.data?.data) {
        setCategories(result.data.data);
      }
    });
    return () => { cancelled = true; };
  }, [selectedType]);

  const onSubmit = async (data: TransactionFormFields) => {
    setServerError(null);
    const { time, date, categoryId, payer: _payer, ...rest } = data;
    const isoDate = parseDateTimeFields(date, time).toISOString();
    const result = await updateTransaction(id, {
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

  if (isLoading) {
    return (
      <div className="lg:col-span-5 flex flex-col gap-4">
        <div className="bg-white border border-stone-100 rounded-xl p-6 animate-pulse">
          <div className="h-4 w-32 bg-stone-100 rounded mb-4" />
          <div className="h-10 w-full bg-stone-100 rounded mb-4" />
          <div className="h-10 w-full bg-stone-100 rounded mb-4" />
          <div className="h-10 w-full bg-stone-100 rounded" />
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="lg:col-span-5 bg-red-50 border border-red-100 rounded-xl p-8 text-center">
        <p className="text-sm text-red-600 mb-3">{fetchError}</p>
        <button
          onClick={() => fetchData({ cancelled: false })}
          className="text-sm text-red-600 underline hover:text-red-800"
        >
          Try again
        </button>
      </div>
    );
  }

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
        />

        <div className="lg:hidden">
          <SaveButton selectedType={selectedType} isSubmitting={isSubmitting} />
        </div>
      </div>

      <LivePreview selectedType={selectedType} control={control} isSubmitting={isSubmitting} />
    </form>
  );
}
