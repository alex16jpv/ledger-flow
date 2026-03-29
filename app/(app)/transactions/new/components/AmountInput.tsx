"use client";
import { Control } from "react-hook-form";
import { TransactionFormFields } from "@/lib/schemas/transaction.schema";
import SharedAmountInput from "@/components/forms/AmountInput";

export default function AmountInput({
  control,
  error,
}: {
  control: Control<TransactionFormFields>;
  error?: string;
}) {
  return <SharedAmountInput control={control} error={error} />;
}
