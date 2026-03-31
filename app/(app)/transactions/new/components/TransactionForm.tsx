import InputDate from "@/components/forms/InputDate";
import InputSelect from "@/components/forms/InputSelect";
import InputText from "@/components/forms/InputText";
import InputTextArea from "@/components/forms/InputTextArea";
import InputTime from "@/components/forms/InputTime";
import { TransactionKind } from "@/types/Transaction.types";
import { TRANSACTION_TYPES, CATEGORY_NAMES } from "@/utils/constants";
import { UseFormRegister, FieldErrors } from "react-hook-form";
import { TransactionFormFields } from "@/lib/schemas/transaction.schema";

export default function TransactionForm({
  selectedType,
  register,
  errors,
  accountOptions = [],
}: {
  selectedType: TransactionKind;
  register: UseFormRegister<TransactionFormFields>;
  errors: FieldErrors<TransactionFormFields>;
  accountOptions?: { value: string; label: string }[];
}) {
  const isTransfer = selectedType === TRANSACTION_TYPES.TRANSFER;
  const isIncome = selectedType === TRANSACTION_TYPES.INCOME;
  const isExpense = selectedType === TRANSACTION_TYPES.EXPENSE;

  const categoryOptions = CATEGORY_NAMES.map((name) => ({
    value: name,
    label: name,
  }));

  return (
    <div
      className="flex flex-col gap-4"
      role="tabpanel"
      aria-labelledby={`tab-${selectedType.toLowerCase()}`}
    >
      {/* Description + date */}
      <section className="bg-white border border-stone-100 rounded-xl p-6 flex flex-col gap-4">
        <InputText
          id="description"
          label="Description"
          placeholder="E.g.: Lunch, Netflix, gas…"
          autoComplete="off"
          registration={register("description")}
          error={errors.description?.message}
        />

        <div className="grid grid-cols-2 gap-4">
          <InputDate
            id="date"
            label="Date"
            registration={register("date")}
            error={errors.date?.message}
          />
          <InputTime
            id="time"
            label="Time"
            registration={register("time")}
            error={errors.time?.message}
          />
        </div>
      </section>

      {/* Accounts */}
      <section className="bg-white border border-stone-100 rounded-xl p-6 flex flex-col gap-4">
        {(isExpense || isTransfer) && (
          <InputSelect
            id="from-account"
            label="From Account"
            options={accountOptions}
            firstOption="Select account…"
            registration={register("from_account_id")}
            error={errors.from_account_id?.message}
          />
        )}

        {isTransfer && (
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-stone-100"></div>
            <div className="transfer-arrow" aria-label="Transfer direction">
              ⇄
            </div>
            <div className="flex-1 h-px bg-stone-100"></div>
          </div>
        )}

        {(isIncome || isTransfer) && (
          <InputSelect
            id="to-account"
            label="To Account"
            options={accountOptions}
            firstOption="Select account…"
            registration={register("to_account_id")}
            error={errors.to_account_id?.message}
          />
        )}

        {isIncome && (
          <InputText
            id="payer"
            label="Payer / Source"
            placeholder="E.g.: Salary, freelance client, gift…"
            autoComplete="off"
            registration={register("payer")}
            error={errors.payer?.message}
          />
        )}
      </section>

      {/* Category */}
      {isExpense && (
        <section className="bg-white border border-stone-100 rounded-xl p-6">
          <InputSelect
            id="category"
            label="Category"
            options={categoryOptions}
            firstOption="Select category…"
            registration={register("category")}
            error={errors.category?.message}
          />
        </section>
      )}

      {/* Tags + note */}
      <section className="bg-white border border-stone-100 rounded-xl p-6 flex flex-col gap-4">
        <InputText
          id="tags"
          label="Tags (comma separated)"
          placeholder="E.g.: recurring, work, deductible…"
          registration={register("tags")}
          error={errors.tags?.message}
        />

        <InputTextArea
          id="note"
          label="Note"
          placeholder="Add an optional comment…"
          rows={2}
          registration={register("note")}
          error={errors.note?.message}
        />
      </section>
    </div>
  );
}
