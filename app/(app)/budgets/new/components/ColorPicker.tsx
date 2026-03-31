import { BudgetColor } from "@/types/Budget.type";
import { BUDGET_COLOR_CLASSES } from "@/utils/constants";

const COLOR_OPTIONS: { value: BudgetColor; label: string }[] = [
  { value: "teal-400", label: "Green" },
  { value: "blue-400", label: "Blue" },
  { value: "purple-400", label: "Purple" },
  { value: "amber-400", label: "Amber" },
  { value: "amber-200", label: "Gold" },
  { value: "red-400", label: "Red" },
  { value: "stone-400", label: "Gray" },
];

export default function ColorPicker({
  selectedColor,
  onColorChange,
}: {
  selectedColor: BudgetColor;
  onColorChange: (color: BudgetColor) => void;
}) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {COLOR_OPTIONS.map((option) => {
        const isSelected = selectedColor === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onColorChange(option.value)}
            className={`w-8 h-8 rounded-full ${BUDGET_COLOR_CLASSES[option.value]} transition-transform hover:scale-110 ${
              isSelected ? "ring-2 ring-stone-800 ring-offset-2" : ""
            }`}
            aria-label={option.label}
            aria-pressed={isSelected}
          />
        );
      })}
    </div>
  );
}
