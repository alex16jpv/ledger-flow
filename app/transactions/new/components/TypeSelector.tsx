import { TypeTransactionType } from "@/types/Transaction.types";
import { TRANSACTION_TYPES } from "@/utils/constants";
import TypeSelectorButton from "./TypeSelectorButton";

const { EXPENSE, INCOME, TRANSFER } = TRANSACTION_TYPES;

export default function TrxTypeSelector({
  selectedType,
  setSelectedType,
}: {
  selectedType: TypeTransactionType;
  setSelectedType: (type: TypeTransactionType) => void;
}) {
  const handleTypeChange = (type: TypeTransactionType) => {
    if (type === selectedType) return;

    setSelectedType(type);
  };

  return (
    <div
      className="flex gap-2 mb-6"
      role="tablist"
      aria-label="Transaction type"
    >
      <TypeSelectorButton
        isSelected={selectedType === EXPENSE}
        onClick={() => handleTypeChange(EXPENSE)}
        className={
          selectedType === EXPENSE
            ? "bg-red-50 text-red-600 border-red-400"
            : undefined
        }
      >
        <span>↓</span> Expense
      </TypeSelectorButton>

      <TypeSelectorButton
        isSelected={selectedType === INCOME}
        onClick={() => handleTypeChange(INCOME)}
        className={
          selectedType === INCOME
            ? "bg-teal-50 text-teal-600 border-teal-400"
            : undefined
        }
      >
        <span>↑</span> Income
      </TypeSelectorButton>

      <TypeSelectorButton
        isSelected={selectedType === TRANSFER}
        onClick={() => handleTypeChange(TRANSFER)}
        className={
          selectedType === TRANSFER
            ? "bg-blue-50 text-blue-600 border-blue-400"
            : undefined
        }
      >
        <span>⇄</span> Transfer
      </TypeSelectorButton>
    </div>
  );
}
