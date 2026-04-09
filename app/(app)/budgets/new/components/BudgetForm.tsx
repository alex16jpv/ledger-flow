import InputText from "@/components/forms/InputText";
import InputSelect from "@/components/forms/InputSelect";
import InputTextArea from "@/components/forms/InputTextArea";
import AmountInput from "@/components/forms/AmountInput";
import { UseFormRegister, FieldErrors, Control } from "react-hook-form";
import { BudgetFormFields } from "@/lib/schemas/budget.schema";
import { BudgetColor } from "@/types/Budget.types";
import ColorPicker from "./ColorPicker";

export default function BudgetForm({
  register,
  errors,
  control,
  selectedColor,
  onColorChange,
  categoryOptions = [],
}: {
  register: UseFormRegister<BudgetFormFields>;
  errors: FieldErrors<BudgetFormFields>;
  control: Control<BudgetFormFields>;
  selectedColor: BudgetColor;
  onColorChange: (color: BudgetColor) => void;
  categoryOptions?: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-4">
      {/* Name */}
      <section className="bg-white border border-stone-100 rounded-xl p-6">
        <h2 className="text-sm font-medium text-stone-700 mb-5">
          Budget Information
        </h2>

        <div className="mb-5">
          <InputText
            id="name"
            label="Budget Name"
            placeholder="E.g.: Food, Transport, Entertainment…"
            registration={register("name")}
            error={errors.name?.message}
          />
        </div>
      </section>

      {/* Category */}
      <section className="bg-white border border-stone-100 rounded-xl p-6">
        <h2 className="text-sm font-medium text-stone-700 mb-5">
          Linked Category
        </h2>
        <InputSelect
          id="category"
          label="Category"
          options={categoryOptions}
          firstOption="Select category…"
          registration={register("categoryId")}
          error={errors.categoryId?.message}
        />
      </section>

      {/* Amount */}
      <section className="bg-white border border-stone-100 rounded-xl p-6">
        <h2 className="text-sm font-medium text-stone-700 mb-5">
          Limit Amount
        </h2>
        <AmountInput
          control={control}
          label="Monthly Limit"
          error={errors.amount?.message}
        />
      </section>

      {/* Color */}
      <section className="bg-white border border-stone-100 rounded-xl p-6">
        <h2 className="text-sm font-medium text-stone-700 mb-5">
          Budget Color
        </h2>
        <ColorPicker
          selectedColor={selectedColor}
          onColorChange={onColorChange}
        />
      </section>

      {/* Notes */}
      <section className="bg-white border border-stone-100 rounded-xl p-6">
        <InputTextArea
          id="note"
          label="Notes (optional)"
          placeholder="Add a description or rules for this budget…"
          rows={3}
          registration={register("note")}
          error={errors.note?.message}
        />
      </section>
    </div>
  );
}
