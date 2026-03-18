"use client";
import { Control, useWatch } from "react-hook-form";
import { TransactionKind } from "@/types/Transaction.types";
import {
  TRANSACTION_TYPE_LABELS,
  TRANSACTION_TYPES,
  TRANSACTION_TYPE_COLORS,
} from "@/utils/constants";
import Link from "next/link";
import { formatDate, formatAmount } from "@/utils/utils";
import { TransactionFormFields } from "@/lib/schemas/transaction.schema";

type LivePreviewProps = {
  selectedType: TransactionKind;
  control: Control<TransactionFormFields>;
};

function formatPreviewDate(date: string, time: string): string {
  if (!date) return "—";
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = (time || "00:00").split(":").map(Number);
  const d = new Date(year, month - 1, day, hours, minutes);
  if (isNaN(d.getTime())) return "—";
  return `${formatDate({ date: d, options: { day: "numeric", month: "short", year: "numeric" } })} · ${time || "00:00"}`;
}

function formatPreviewAmount(amount?: number): string {
  if (amount === undefined || isNaN(amount)) return "$0.00";
  return formatAmount({
    amount,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function SaveButton({
  selectedType,
}: {
  selectedType: TransactionKind;
}) {
  const selectedColors = TRANSACTION_TYPE_COLORS[selectedType];
  return (
    <button
      type="submit"
      className={`w-full ${selectedColors.btnBgColor} ${selectedColors.btnHoverBgColor} text-white font-medium text-sm rounded-xl py-3 transition-colors`}
    >
      {selectedType === TRANSACTION_TYPES.TRANSFER
        ? "Confirm Transfer"
        : `Save ${TRANSACTION_TYPE_LABELS[selectedType]}`}
    </button>
  );
}

export default function LivePreview({
  selectedType,
  control,
}: LivePreviewProps) {
  const [amount, description, date, time, fromAccount, toAccount] = useWatch({
    control,
    name: [
      "amount",
      "description",
      "date",
      "time",
      "from_account_id",
      "to_account_id",
    ],
  });

  const selectedColors = TRANSACTION_TYPE_COLORS[selectedType];

  const accountLabel =
    selectedType === TRANSACTION_TYPES.EXPENSE
      ? fromAccount
      : selectedType === TRANSACTION_TYPES.INCOME
        ? toAccount
        : null;

  const transferLabel =
    selectedType === TRANSACTION_TYPES.TRANSFER
      ? `${fromAccount || "—"} → ${toAccount || "—"}`
      : null;

  return (
    <div className="lg:col-span-2 flex flex-col gap-5">
      <div className="sticky top-24 flex flex-col gap-4">
        {/* Preview card */}
        <div className="bg-white border border-stone-100 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100">
            <p className="text-sm font-medium text-stone-800">Preview</p>
          </div>

          <div className="p-5 flex flex-col gap-4">
            {/* Amount preview */}
            <div
              className={`rounded-xl p-4 text-center border ${selectedColors.borderColor} ${selectedColors.bgColor} transition-all`}
            >
              <p
                className={`font-mono text-[10px] uppercase tracking-widest ${selectedColors.textColor} mb-1`}
              >
                {TRANSACTION_TYPE_LABELS[selectedType]}
              </p>
              <p className="font-display text-3xl font-medium text-stone-800">
                {formatPreviewAmount(amount)}
              </p>
              {description && (
                <p className="text-sm text-stone-500 mt-1 truncate">
                  {description}
                </p>
              )}
            </div>

            {/* Details */}
            <div className="flex flex-col gap-0">
              <div className="preview-row">
                <span className="font-mono text-xs text-stone-400">Type</span>
                <span className="text-sm text-stone-700">
                  {TRANSACTION_TYPE_LABELS[selectedType]}
                </span>
              </div>

              {accountLabel !== null && (
                <div className="preview-row">
                  <span className="font-mono text-xs text-stone-400">
                    Account
                  </span>
                  <span className="text-sm text-stone-700">
                    {accountLabel || "—"}
                  </span>
                </div>
              )}

              {transferLabel && (
                <div className="preview-row">
                  <span className="font-mono text-xs text-stone-400">
                    Transfer
                  </span>
                  <span className="text-blue-600 font-mono text-xs">
                    {transferLabel}
                  </span>
                </div>
              )}

              <div className="preview-row">
                <span className="font-mono text-xs text-stone-400">Date</span>
                <span className="text-sm text-stone-700">
                  {formatPreviewDate(date, time)}
                </span>
              </div>
            </div>

            <SaveButton selectedType={selectedType} />

            <Link
              href="/transactions"
              className="text-center text-stone-400 hover:text-stone-600 font-mono text-xs py-1 transition-colors block"
            >
              Cancel
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
