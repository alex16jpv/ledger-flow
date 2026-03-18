"use client";
import { useEffect } from "react";
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
import { getCurrentDate, getCurrentTime } from "@/utils/utils";

const DEFAULT_VALUES: TransactionFormFields = {
  type: TRANSACTION_TYPES.EXPENSE,
  amount: undefined as unknown as number,
  description: "",
  date: "",
  time: "",
  fromAccount: "",
  toAccount: "",
  payer: "",
  tags: "",
  note: "",
};

export default function NewTransactionContainer() {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    clearErrors,
    reset,
    control,
    formState: { errors },
  } = useForm<TransactionFormFields>({
    resolver: zodResolver(transactionSchema) as Resolver<TransactionFormFields>,
    defaultValues: DEFAULT_VALUES,
  });

  useEffect(() => {
    setValue("date", getCurrentDate());
    setValue("time", getCurrentTime());
  }, [setValue]);

  const selectedType = watch("type");

  const setSelectedType = (type: TransactionKind) => {
    setValue("type", type);
    setValue("date", getCurrentDate());
    setValue("time", getCurrentTime());
    setValue("fromAccount", "");
    setValue("toAccount", "");
    setValue("payer", "");
    clearErrors();
  };

  const onSubmit = (data: TransactionFormFields) => {
    const { time, date, type, ...rest } = data;
    const dateWithTime = new Date(`${date}T${time || "00:00"}`);
    console.log("Transaction data:", { ...rest, type, date: dateWithTime });

    reset({
      ...DEFAULT_VALUES,
      date: getCurrentDate(),
      time: getCurrentTime(),
      type,
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="contents">
      <div className="lg:col-span-3 flex flex-col gap-5">
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
        />

        <div className="lg:hidden">
          <SaveButton selectedType={selectedType} />
        </div>
      </div>

      <LivePreview selectedType={selectedType} control={control} />
    </form>
  );
}
