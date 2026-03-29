"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { budgetSchema, BudgetFormFields } from "@/lib/schemas/budget.schema";
import { BudgetColor } from "@/types/Budget.type";
import BudgetForm from "./BudgetForm";
import BudgetPreview, { SaveButton } from "./BudgetPreview";

const DEFAULT_VALUES: BudgetFormFields = {
  name: "",
  emoji: "🍔",
  color: "teal-400",
  category: "Food",
  amount: 0,
  note: "",
};

export default function NewBudgetContainer() {
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
  const emoji = watch("emoji");
  const color = watch("color");
  const category = watch("category");
  const amount = watch("amount");

  const onEmojiChange = (newEmoji: string) => {
    setValue("emoji", newEmoji, { shouldValidate: true });
  };

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
          selectedEmoji={emoji}
          onEmojiChange={onEmojiChange}
          selectedColor={color}
          onColorChange={onColorChange}
        />

        <div className="lg:hidden">
          <SaveButton />
        </div>
      </div>

      <BudgetPreview
        name={name}
        emoji={emoji}
        color={color}
        category={category}
        amount={amount}
      />
    </form>
  );
}
