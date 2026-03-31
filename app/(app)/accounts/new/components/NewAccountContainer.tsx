"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createAccountSchema,
  CreateAccountFormFields,
} from "@/lib/schemas/account.schema";
import { createAccount } from "@/services/accounts.service";
import AccountForm from "./AccountForm";

export default function NewAccountContainer() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CreateAccountFormFields>({
    resolver: zodResolver(createAccountSchema),
    defaultValues: { name: "", type: "CASH", balance: 0 },
  });

  const onSubmit = async (data: CreateAccountFormFields) => {
    setServerError(null);

    const result = await createAccount(data);

    if (result.error) {
      setServerError(result.error);
      return;
    }

    router.push("/accounts");
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      {serverError && (
        <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3">
          {serverError}
        </div>
      )}

      <AccountForm
        register={register}
        errors={errors}
        control={control}
        showBalance={true}
      />

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-teal-400 hover:bg-teal-600 text-white font-medium py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? "Creating…" : "Create Account"}
      </button>
    </form>
  );
}
