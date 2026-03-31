"use client";
import { useEffect, useState } from "react";
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

function getDefaultValues(): Partial<TransactionFormFields> & {
  type: TransactionFormFields["type"];
} {
  const { date, time } = getCurrentDateTime();
  return {
    type: TRANSACTION_TYPES.EXPENSE,
    description: "",
    date,
    time,
    category: "",
    from_account_id: "",
    to_account_id: "",
    payer: "",
    tags: "",
    note: "",
  };
}

export default function NewTransactionContainer() {
  const [accountOptions, setAccountOptions] = useState<
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
  }, []);

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
    defaultValues: getDefaultValues(),
  });

  const selectedType = watch("type");

  const setSelectedType = (type: TransactionKind) => {
    const { date, time } = getCurrentDateTime();
    setValue("type", type);
    setValue("date", date);
    setValue("time", time);
    setValue("category", "");
    setValue("from_account_id", "");
    setValue("to_account_id", "");
    setValue("payer", "");
    clearErrors();
  };

  const onSubmit = (data: TransactionFormFields) => {
    const { time, date, ...rest } = data;
    const dateWithTime = parseDateTimeFields(date, time);
    console.log("Transaction data:", { ...rest, date: dateWithTime });

    reset({
      ...getDefaultValues(),
      type: data.type,
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
          accountOptions={accountOptions}
        />

        <div className="lg:hidden">
          <SaveButton selectedType={selectedType} />
        </div>
      </div>

      <LivePreview selectedType={selectedType} control={control} />
    </form>
  );
}
