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
import { getCurrentDateTime, parseDateTimeFields, formatDate, formatTime } from "@/lib/dates";
import { getAccounts } from "@/services/accounts.service";
import { getCategories } from "@/services/categories.service";
import {
  getTransaction,
  updateTransaction,
} from "@/services/transactions.service";

export default function EditTransactionContainer({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [accountOptions, setAccountOptions] = useState<
    { value: string; label: string }[]
  >([]);
  const [categoryOptions, setCategoryOptions] = useState<
    { value: string; label: string }[]
  >([]);

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
    resolver: zodResolver(transactionSchema) as Resolver<TransactionFormFields>,
  });

  const selectedType = watch("type");

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

  const fetchData = useCallback(async () => {
    setLoading(true);
    setFetchError(null);

    const [txResult, accResult, catResult] = await Promise.all([
      getTransaction(id),
      getAccounts(),
      getCategories({ limit: "100" }),
    ]);

    if (accResult.data?.data) {
      setAccountOptions(
        accResult.data.data.map((a) => ({ value: a.id, label: a.name })),
      );
    }
    if (catResult.data?.data) {
      setCategoryOptions(
        catResult.data.data.map((c) => ({
          value: c.id,
          label: c.emoji ? `${c.emoji} ${c.name}` : c.name,
        })),
      );
    }

    if (txResult.error || !txResult.data) {
      setFetchError(txResult.error ?? "Transaction not found");
      setLoading(false);
      return;
    }

    const tx = txResult.data;
    const txDate = tx.date ? formatDate(tx.date, "iso") : getCurrentDateTime().date;
    const txTime = tx.date ? formatTime(tx.date) : getCurrentDateTime().time;

    reset({
      type: tx.type,
      amount: tx.amount,
      description: tx.description ?? "",
      date: txDate,
      time: txTime,
      categoryId: tx.categoryId ?? "",
      fromAccountId: tx.fromAccountId ?? "",
      toAccountId: tx.toAccountId ?? "",
      tags: tx.tags ?? "",
      note: tx.note ?? "",
      payer: "",
    });

    setLoading(false);
  }, [id, reset]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  if (loading) {
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
          onClick={fetchData}
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
            setSelectedType={setSelectedType}
          />
          <AmountInput control={control} error={errors.amount?.message} />
        </section>

        <TransactionForm
          selectedType={selectedType}
          register={register}
          errors={errors}
          accountOptions={accountOptions}
          categoryOptions={categoryOptions}
        />

        <div className="lg:hidden">
          <SaveButton selectedType={selectedType} isSubmitting={isSubmitting} />
        </div>
      </div>

      <LivePreview selectedType={selectedType} control={control} isSubmitting={isSubmitting} />
    </form>
  );
}
