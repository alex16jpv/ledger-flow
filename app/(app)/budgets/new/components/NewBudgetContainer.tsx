"use client";

import { useEffect, useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { budgetSchema, BudgetFormFields } from "@/lib/schemas/budget.schema";
import { BudgetColor } from "@/types/Budget.types";
import { Category } from "@/types/Category.types";
import { getCategories } from "@/services/categories.service";
import { DEFAULT_LIST_LIMIT } from "@/utils/constants";
import BudgetForm from "./BudgetForm";
import BudgetPreview, { SaveButton } from "./BudgetPreview";

const DEFAULT_VALUES: BudgetFormFields = {
  name: "",
  color: "teal-400",
  categoryId: "",
  amount: 0,
  note: "",
};

export default function NewBudgetContainer() {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    getCategories({ limit: DEFAULT_LIST_LIMIT }).then((res) => {
      setCategories(res.data?.data ?? []);
    });
  }, []);

  const categoryOptions = useMemo(
    () =>
      categories.map((c) => ({
        value: c.id,
        label: c.emoji ? `${c.emoji} ${c.name}` : c.name,
      })),
    [categories],
  );

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

  const onSubmit = (_data: BudgetFormFields) => {
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
