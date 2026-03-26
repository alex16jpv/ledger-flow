import { Account } from "@/types/Account.types";

export const MOCK_ACCOUNTS: Account[] = [
  {
    id: "acc_nacion",
    name: "Banco Nación",
    type: "DEBIT",
    balance: 32400,
    user_id: "user_1",
    createdAt: new Date("2024-01-12T10:00:00Z"),
    updatedAt: new Date("2026-03-17T09:00:00Z"),
  },
  {
    id: "acc_galicia",
    name: "Galicia Savings",
    type: "SAVINGS",
    balance: 18750,
    user_id: "user_1",
    createdAt: new Date("2024-03-05T14:30:00Z"),
    updatedAt: new Date("2026-03-16T12:30:00Z"),
  },
  {
    id: "acc_visa",
    name: "Visa Santander",
    type: "CREDIT",
    balance: -5200,
    user_id: "user_1",
    createdAt: new Date("2024-06-20T09:00:00Z"),
    updatedAt: new Date("2026-03-16T14:00:00Z"),
  },
  {
    id: "acc_mp",
    name: "Mercado Pago",
    type: "DIGITAL_WALLET",
    balance: 4100,
    user_id: "user_1",
    createdAt: new Date("2024-08-01T11:00:00Z"),
    updatedAt: new Date("2026-03-17T09:32:00Z"),
  },
  {
    id: "acc_invest",
    name: "Balanz Investments",
    type: "INVESTMENT",
    balance: 45000,
    user_id: "user_1",
    createdAt: new Date("2025-01-15T10:00:00Z"),
    updatedAt: new Date("2026-03-10T08:00:00Z"),
  },
  {
    id: "acc_cash",
    name: "Cash",
    type: "CASH",
    balance: 2800,
    user_id: "user_1",
    createdAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2026-03-15T17:00:00Z"),
  },
];

export const MOCK_ACCOUNT_OPTIONS = MOCK_ACCOUNTS.map((account) => ({
  value: account.id,
  label: `${account.name}`,
}));
