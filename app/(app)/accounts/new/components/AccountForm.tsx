import InputText from "@/components/forms/InputText";
import InputSelect from "@/components/forms/InputSelect";
import AmountInput from "@/components/forms/AmountInput";
import { UseFormRegister, FieldErrors, Control } from "react-hook-form";
import { CreateAccountFormFields } from "@/lib/schemas/account.schema";
import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABELS } from "@/utils/constants";

const ACCOUNT_TYPE_OPTIONS = Object.values(ACCOUNT_TYPES).map((type) => ({
  value: type,
  label: ACCOUNT_TYPE_LABELS[type],
}));

export default function AccountForm({
  register,
  errors,
  control,
  showBalance = true,
}: {
  register: UseFormRegister<CreateAccountFormFields>;
  errors: FieldErrors<CreateAccountFormFields>;
  control: Control<CreateAccountFormFields>;
  showBalance?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
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
      </section>

      {showBalance && (
        <section className="bg-white border border-stone-100 rounded-xl p-6">
          <h2 className="text-sm font-medium text-stone-700 mb-4">
            Initial Balance
          </h2>
          <AmountInput
            control={control}
            error={errors.balance?.message}
            label="Balance"
            name="balance"
          />
        </section>
      )}
    </div>
  );
}
