"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import AmountInput from "./AmountInput";
import LivePreview, { SaveButton } from "./LivePreview";
import TransactionForm from "./TransactionForm";
import TransactionTypeSelector from "./TypeSelector";
import { TRANSACTION_TYPES } from "@/utils/constants";
import {
  transactionSchema,
  TransactionFormFields,
} from "@/lib/schemas/transaction.schema";
import { TransactionKind } from "@/types/Transaction.types";
import { getCurrentDateTime, parseDateTimeFields } from "@/lib/dates";
import { getAccounts } from "@/services/accounts.service";
import { getCategories } from "@/services/categories.service";
import { createTransaction } from "@/services/transactions.service";

function getDefaultValues(): Partial<TransactionFormFields> & {
  type: TransactionFormFields["type"];
} {
  const { date, time } = getCurrentDateTime();
  return {
    type: TRANSACTION_TYPES.EXPENSE,
    description: "",
    date,
    time,
    categoryId: "",
    fromAccountId: "",
    toAccountId: "",
    payer: "",
    tags: "",
    note: "",
  };
}

export default function NewTransactionContainer() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [accountOptions, setAccountOptions] = useState<
    { value: string; label: string }[]
  >([]);
  const [categoryOptions, setCategoryOptions] = useState<
    { value: string; label: string }[]
  >([]);

  useEffect(() => {
    getAccounts().then((result) => {
      if (result.data?.data) {
        setAccountOptions(
          result.data.data.map((a) => ({ value: a.id, label: a.name })),
        );
      }
    });
    getCategories().then((result) => {
      if (result.data?.data) {
        setCategoryOptions(
          result.data.data.map((c) => ({
            value: c.id,
            label: c.emoji ? `${c.emoji} ${c.name}` : c.name,
          })),
        );
      }
    });
  }, []);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    clearErrors,
    control,
    formState: { errors, isSubmitting },
  } = useForm<TransactionFormFields>({
    resolver: zodResolver(transactionSchema) as Resolver<TransactionFormFields>,
    defaultValues: getDefaultValues(),
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
