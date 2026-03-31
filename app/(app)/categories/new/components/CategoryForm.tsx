import InputText from "@/components/forms/InputText";
import { UseFormRegister, FieldErrors } from "react-hook-form";
import { CreateCategoryFormFields, type CategoryEmoji } from "@/lib/schemas/category.schema";
import CategoryEmojiPicker from "./CategoryEmojiPicker";

export default function CategoryForm({
  register,
  errors,
  selectedEmoji,
  onEmojiChange,
}: {
  register: UseFormRegister<CreateCategoryFormFields>;
  errors: FieldErrors<CreateCategoryFormFields>;
  selectedEmoji: string;
  onEmojiChange: (emoji: CategoryEmoji) => void;
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
      </section>

      <section className="bg-white border border-stone-100 rounded-xl p-6">
        <h2 className="text-sm font-medium text-stone-700 mb-4">
          Category Icon
        </h2>
        <CategoryEmojiPicker
          selectedEmoji={selectedEmoji}
          onEmojiChange={onEmojiChange}
        />
        {errors.emoji?.message && (
          <p className="text-red-500 text-xs mt-2">{errors.emoji.message}</p>
        )}
      </section>
    </div>
  );
}
