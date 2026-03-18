import { z } from "zod";

const amount = z
  .number({ message: "Amount is required" })
  .positive("Amount must be greater than 0");
const description = z.string().min(1, "Description is required");
const date = z.string().min(1, "Date is required");
const time = z.string();
const account = z.string().min(1, "Account is required");
const tags = z.string().optional();
const note = z.string().optional();

const expenseSchema = z.object({
  type: z.literal("EXPENSE"),
  amount,
  description,
  date,
  time,
  fromAccount: account,
  tags,
  note,
});

const incomeSchema = z.object({
  type: z.literal("INCOME"),
  amount,
  description,
  date,
  time,
  toAccount: account,
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
  fromAccount: account,
  toAccount: account,
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
  fromAccount?: string;
  toAccount?: string;
  payer?: string;
  tags?: string;
  note?: string;
};
