import InputText from "@/components/forms/InputText";
import InputSelect from "@/components/forms/InputSelect";
import EmojiPicker from "@/components/forms/EmojiPicker";
import CategoryColorPicker from "@/components/forms/CategoryColorPicker";
import { UseFormRegister, FieldErrors } from "react-hook-form";
import { CreateCategoryFormFields } from "@/lib/schemas/category.schema";
import { type CategoryColor } from "@/utils/constants";

const TYPE_OPTIONS = [
  { value: "EXPENSE", label: "Expense" },
  { value: "INCOME", label: "Income" },
  { value: "TRANSFER", label: "Transfer" },
];

export default function CategoryForm({
  register,
  errors,
  selectedEmoji,
  onEmojiChange,
  selectedColor,
  onColorChange,
}: {
  register: UseFormRegister<CreateCategoryFormFields>;
  errors: FieldErrors<CreateCategoryFormFields>;
  selectedEmoji: string;
  onEmojiChange: (emoji: string) => void;
  selectedColor?: string;
  onColorChange: (color: CategoryColor) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <section className="bg-white border border-stone-100 rounded-xl p-6 flex flex-col gap-4">
        <h2 className="text-sm font-medium text-stone-700 mb-1">
          Category Information
        </h2>

        <InputText
          id="name"
          label="Category Name"
          placeholder="E.g.: Food, Transport, Entertainment…"
          registration={register("name")}
          error={errors.name?.message}
        />

        <InputSelect
          id="type"
          label="Type"
          options={TYPE_OPTIONS}
          firstOption="Select type…"
          registration={register("type")}
          error={errors.type?.message}
        />
      </section>

      <section className="bg-white border border-stone-100 rounded-xl p-6 flex flex-col gap-5">
        <h2 className="text-sm font-medium text-stone-700 mb-1">
          Appearance
        </h2>

        <EmojiPicker
          selectedEmoji={selectedEmoji}
          onEmojiChange={onEmojiChange}
          error={errors.emoji?.message}
        />

        <CategoryColorPicker
          selectedColor={selectedColor}
          onColorChange={onColorChange}
          error={errors.color?.message}
        />
      </section>
    </div>
  );
}
