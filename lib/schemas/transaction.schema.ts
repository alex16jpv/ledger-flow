import { z } from "zod";

const amount = z
  .number({ message: "Amount is required" })
  .positive("Amount must be greater than 0");
const description = z.string().min(1, "Description is required");
const date = z
  .string()
  .min(1, "Date is required")
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)");
const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Invalid time format (HH:MM)")
  .or(z.literal(""));
const account = z.string().min(1, "Account is required");
const category = z.string().optional();
const tags = z.string().optional();
const note = z.string().optional();

const expenseSchema = z.object({
  type: z.literal("EXPENSE"),
  amount,
  description,
  date,
  time,
  category,
  from_account_id: account,
  tags,
  note,
});

const incomeSchema = z.object({
  type: z.literal("INCOME"),
  amount,
  description,
  date,
  time,
  to_account_id: account,
  payer: z.string().optional(),
  tags,
  note,
});

const transferSchema = z.object({
  type: z.literal("TRANSFER"),
  amount,
  description,
  date,
  time,
  from_account_id: account,
  to_account_id: account,
  tags,
  note,
});

export const transactionSchema = z.discriminatedUnion("type", [
  expenseSchema,
  incomeSchema,
  transferSchema,
]);

export type TransactionFormData = z.infer<typeof transactionSchema>;

// Flat type with all possible fields for react-hook-form.
// Variant-specific fields are optional so the form can hold any state.
export type TransactionFormFields = {
  type: TransactionFormData["type"];
  amount: number;
  description: string;
  date: string;
  time: string;
  from_account_id?: string;
  to_account_id?: string;
  payer?: string;
  tags?: string;
  note?: string;
  category?: string;
};
