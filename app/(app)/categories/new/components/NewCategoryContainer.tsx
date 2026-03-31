"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createCategorySchema,
  CreateCategoryFormFields,
} from "@/lib/schemas/category.schema";
import { createCategory } from "@/services/categories.service";
import CategoryForm from "./CategoryForm";

export default function NewCategoryContainer() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateCategoryFormFields>({
    resolver: zodResolver(createCategorySchema),
    defaultValues: { name: "", emoji: undefined },
  });

  const selectedEmoji = watch("emoji") ?? "";

  const onEmojiChange = (emoji: string) => {
    setValue("emoji", emoji as CreateCategoryFormFields["emoji"], {
      shouldValidate: true,
    });
  };

  const onSubmit = async (data: CreateCategoryFormFields) => {
    setServerError(null);

    const result = await createCategory(data);

    if (result.error) {
      setServerError(result.error);
      return;
    }

    router.push("/categories");
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      {serverError && (
        <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3">
          {serverError}
        </div>
      )}

      <CategoryForm
        register={register}
        errors={errors}
        selectedEmoji={selectedEmoji}
        onEmojiChange={onEmojiChange}
      />

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-teal-400 hover:bg-teal-600 text-white font-medium py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? "Creating…" : "Create Category"}
      </button>
    </form>
  );
}
