"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import InputText from "@/components/forms/InputText";
import InputSelect from "@/components/forms/InputSelect";
import EmojiPicker from "@/components/forms/EmojiPicker";
import CategoryColorPicker from "@/components/forms/CategoryColorPicker";
import {
  updateCategorySchema,
  UpdateCategoryFormFields,
} from "@/lib/schemas/category.schema";
import { type CategoryColor } from "@/utils/constants";
import { getCategory, updateCategory } from "@/services/categories.service";

const TYPE_OPTIONS = [
  { value: "EXPENSE", label: "Expense" },
  { value: "INCOME", label: "Income" },
  { value: "TRANSFER", label: "Transfer" },
];

export default function EditCategoryContainer({ id }: { id: string }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<UpdateCategoryFormFields>({
    resolver: zodResolver(updateCategorySchema),
  });

  const selectedEmoji = watch("emoji") ?? "";
  const selectedColor = watch("color") ?? "";

  const onEmojiChange = (emoji: string) => {
    setValue("emoji", emoji, { shouldValidate: true });
  };

  const onColorChange = (color: CategoryColor) => {
    setValue("color", color, { shouldValidate: true });
  };

  const fetchCategory = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    const result = await getCategory(id);
    if (result.error || !result.data) {
      setFetchError(result.error ?? "Category not found");
    } else {
      reset({
        name: result.data.name,
        emoji: result.data.emoji,
        color: result.data.color,
        type: result.data.type,
      });
    }
    setIsLoading(false);
  }, [id, reset]);

  useEffect(() => {
    fetchCategory();
  }, [fetchCategory]);

  const onSubmit = async (data: UpdateCategoryFormFields) => {
    setServerError(null);
    const result = await updateCategory(id, data);
    if (result.error) {
      setServerError(result.error);
      return;
    }
    router.push("/categories");
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="bg-white border border-stone-100 rounded-xl p-6 animate-pulse">
          <div className="h-4 w-32 bg-stone-100 rounded mb-4" />
          <div className="h-10 w-full bg-stone-100 rounded mb-4" />
          <div className="h-20 w-full bg-stone-100 rounded" />
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="bg-red-50 border border-red-100 rounded-xl p-8 text-center">
        <p className="text-sm text-red-600 mb-3">{fetchError}</p>
        <button
          onClick={fetchCategory}
          className="text-sm text-red-600 underline hover:text-red-800"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      {serverError && (
        <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3">
          {serverError}
        </div>
      )}

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

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-teal-400 hover:bg-teal-600 text-white font-medium py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? "Saving…" : "Save Changes"}
      </button>
    </form>
  );
}
