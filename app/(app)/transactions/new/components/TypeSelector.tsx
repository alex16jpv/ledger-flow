import { TransactionKind } from "@/types/Transaction.types";
import { TRANSACTION_TYPES, TRANSACTION_TYPE_COLORS } from "@/utils/constants";
import TypeSelectorButton from "./TypeSelectorButton";

const TYPE_OPTIONS = [
  { type: TRANSACTION_TYPES.EXPENSE, icon: "↓", label: "Expense" },
  { type: TRANSACTION_TYPES.INCOME, icon: "↑", label: "Income" },
  { type: TRANSACTION_TYPES.TRANSFER, icon: "⇄", label: "Transfer" },
] as const;

export default function TransactionTypeSelector({
  selectedType,
  setSelectedType,
}: {
  selectedType: TransactionKind;
  setSelectedType: (type: TransactionKind) => void;
}) {
  const handleTypeChange = (type: TransactionKind) => {
    if (type === selectedType) return;

    setSelectedType(type);
  };

  return (
    <div
      className="flex gap-2 mb-6"
      role="tablist"
      aria-label="Transaction type"
    >
      {TYPE_OPTIONS.map(({ type, icon, label }) => (
        <TypeSelectorButton
          key={type}
          isSelected={selectedType === type}
          onClick={() => handleTypeChange(type)}
          className={
            selectedType === type
              ? TRANSACTION_TYPE_COLORS[type].selectedClass
              : undefined
          }
        >
          <span>{icon}</span> {label}
        </TypeSelectorButton>
      ))}
    </div>
  );
}
