"use client";
import { useState } from "react";
import AmountInput from "./AmountInput";
import LivePreview from "./LivePreview";
import TransactionForm from "./TransactionForm";
import TrxTypeSelector from "./TypeSelector";
import { TypeTransactionType } from "@/types/Transaction.types";
import { TRANSACTION_TYPES } from "@/utils/constants";

export default function NewTransactionContainer() {
  const [selectedType, setSelectedType] = useState<TypeTransactionType>(
    TRANSACTION_TYPES.EXPENSE,
  );

  return (
    <>
      <div className="lg:col-span-3 flex flex-col gap-5">
        <section className="bg-white border border-stone-100 rounded-xl p-6">
          <TrxTypeSelector
            selectedType={selectedType}
            setSelectedType={setSelectedType}
          />
          <AmountInput />
        </section>

        <TransactionForm selectedType={selectedType} />
      </div>

      <LivePreview selectedType={selectedType} />
    </>
  );
}
