"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, RegisterFormFields } from "@/lib/schemas/auth.schema";
import { register as registerUser } from "@/services/auth.service";
import InputText from "@/components/forms/InputText";
import FieldError from "@/components/forms/FieldError";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormFields>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const onSubmit = async (data: RegisterFormFields) => {
    setServerError(null);
    setIsSubmitting(true);

    try {
      const result = await registerUser(data);

      if (result.error) {
        setServerError(result.error);
        return;
      }

      router.push("/login");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-sm">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-display font-bold text-stone-900">
          Create your account
        </h1>
        <p className="text-sm text-stone-400 mt-1">
          Start tracking your finances
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <div className="bg-white border border-stone-100 rounded-xl p-6 flex flex-col gap-4">
          {serverError && (
            <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">
              {serverError}
            </div>
          )}

          <InputText
            id="name"
            label="Name"
            placeholder="John Doe"
            autoComplete="name"
            registration={register("name")}
            error={errors.name?.message}
          />

          <InputText
            id="email"
            label="Email"
            placeholder="you@example.com"
            autoComplete="email"
            registration={register("email")}
            error={errors.email?.message}
          />

          <div>
            <label htmlFor="password" className="field-label">
              Password
            </label>
            <input
              id="password"
              type="password"
              className="input-base"
              placeholder="At least 8 characters"
              autoComplete="new-password"
              {...register("password")}
            />
            <FieldError message={errors.password?.message} />
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-teal-400 hover:bg-teal-600 text-white font-medium py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "Creating account…" : "Create account"}
        </button>

        <p className="text-center text-sm text-stone-400">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-teal-400 hover:text-teal-600 font-medium"
          >
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
