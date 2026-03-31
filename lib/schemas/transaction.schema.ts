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
  categoryId: category,
  fromAccountId: account,
  tags,
  note,
});

const incomeSchema = z.object({
  type: z.literal("INCOME"),
  amount,
  description,
  date,
  time,
  toAccountId: account,
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
  fromAccountId: account,
  toAccountId: account,
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
  fromAccountId?: string;
  toAccountId?: string;
  payer?: string;
  tags?: string;
  note?: string;
  categoryId?: string;
};

// ---------------------------------------------------------------------------
// API route-handler schemas (server-side validation before proxying)
// ---------------------------------------------------------------------------

export const createTransactionSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
  amount: z.number().positive(),
  date: z.string(),
  categoryId: z.string().nullable().optional(),
  description: z.string().max(255).nullable().optional(),
  fromAccountId: z.string().nullable().optional(),
  toAccountId: z.string().nullable().optional(),
  tags: z.string().max(500).nullable().optional(),
  note: z.string().max(1000).nullable().optional(),
});

export type CreateTransactionPayload = z.infer<typeof createTransactionSchema>;

export const updateTransactionSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]).optional(),
  amount: z.number().positive().optional(),
  date: z.string().optional(),
  categoryId: z.string().nullable().optional(),
  description: z.string().max(255).nullable().optional(),
  fromAccountId: z.string().nullable().optional(),
  toAccountId: z.string().nullable().optional(),
  tags: z.string().max(500).nullable().optional(),
  note: z.string().max(1000).nullable().optional(),
});

export type UpdateTransactionPayload = z.infer<typeof updateTransactionSchema>;
