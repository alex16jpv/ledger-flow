"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import InputText from "@/components/forms/InputText";
import InputSelect from "@/components/forms/InputSelect";
import FieldError from "@/components/forms/FieldError";
import {
  updateAccountSchema,
  UpdateAccountFormFields,
} from "@/lib/schemas/account.schema";
import { getAccount, updateAccount } from "@/services/accounts.service";
import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABELS } from "@/utils/constants";

const ACCOUNT_TYPE_OPTIONS = Object.values(ACCOUNT_TYPES).map((type) => ({
  value: type,
  label: ACCOUNT_TYPE_LABELS[type],
}));

export default function EditAccountContainer({ id }: { id: string }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UpdateAccountFormFields>({
    resolver: zodResolver(updateAccountSchema),
  });

  const fetchAccount = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    const result = await getAccount(id);
    if (result.error || !result.data) {
      setFetchError(result.error ?? "Account not found");
    } else {
      reset({ name: result.data.name, type: result.data.type });
    }
    setIsLoading(false);
  }, [id, reset]);

  useEffect(() => {
    fetchAccount();
  }, [fetchAccount]);

  const onSubmit = async (data: UpdateAccountFormFields) => {
    setServerError(null);
    const result = await updateAccount(id, data);
    if (result.error) {
      setServerError(result.error);
      return;
    }
    router.push(`/accounts/${id}`);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="bg-white border border-stone-100 rounded-xl p-6 animate-pulse">
          <div className="h-4 w-32 bg-stone-100 rounded mb-4" />
          <div className="h-10 w-full bg-stone-100 rounded mb-4" />
          <div className="h-10 w-full bg-stone-100 rounded" />
        </div>
      </div>
    );
  }

  if (!isLoading && fetchError) {
    return (
      <div className="bg-red-50 border border-red-100 rounded-xl p-8 text-center">
        <p className="text-sm text-red-600 mb-3">{fetchError}</p>
        <button
          onClick={fetchAccount}
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
          Account Information
        </h2>

        <InputText
          id="name"
          label="Account Name"
          placeholder="E.g.: Savings, Visa Card, Cash…"
          registration={register("name")}
          error={errors.name?.message}
        />

        <InputSelect
          id="type"
          label="Account Type"
          options={ACCOUNT_TYPE_OPTIONS}
          firstOption="Select type…"
          registration={register("type")}
          error={errors.type?.message}
        />

        {errors.root?.message && <FieldError message={errors.root.message} />}
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
