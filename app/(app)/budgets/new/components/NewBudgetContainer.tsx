"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { budgetSchema, BudgetFormFields } from "@/lib/schemas/budget.schema";
import { BudgetColor } from "@/types/Budget.type";
import type { Category } from "@/types/Category.types";
import BudgetForm from "./BudgetForm";
import BudgetPreview, { SaveButton } from "./BudgetPreview";
import { getCategories } from "@/services/categories.service";

const DEFAULT_VALUES: BudgetFormFields = {
  name: "",
  color: "teal-400",
  categoryId: "",
  amount: 0,
  note: "",
};

export default function NewBudgetContainer() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<
    { value: string; label: string }[]
  >([]);

  useEffect(() => {
    getCategories().then((result) => {
      if (result.data?.data) {
        setCategories(result.data.data);
        setCategoryOptions(
          result.data.data.map((c) => ({
            value: c.id,
            label: c.emoji ? `${c.emoji} ${c.name}` : c.name,
          })),
        );
      }
    });
  }, []);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    control,
    formState: { errors },
  } = useForm<BudgetFormFields>({
    resolver: zodResolver(budgetSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const name = watch("name");
  const color = watch("color");
  const categoryId = watch("categoryId");
  const amount = watch("amount");

  const selectedCategory = categories.find((c) => c.id === categoryId);

  const onColorChange = (newColor: BudgetColor) => {
    setValue("color", newColor, { shouldValidate: true });
  };

  const onSubmit = (data: BudgetFormFields) => {
    console.log("Budget data:", data);
    reset(DEFAULT_VALUES);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="contents">
      <div className="lg:col-span-3 flex flex-col gap-5">
        <BudgetForm
          register={register}
          errors={errors}
          control={control}
          selectedColor={color}
          onColorChange={onColorChange}
          categoryOptions={categoryOptions}
        />

        <div className="lg:hidden">
          <SaveButton />
        </div>
      </div>

      <BudgetPreview
        name={name}
        emoji={selectedCategory?.emoji ?? ""}
        color={color}
        category={selectedCategory?.name ?? ""}
        amount={amount}
      />
    </form>
  );
}
