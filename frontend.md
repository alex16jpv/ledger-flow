# Ledger Flow — Frontend Reference

> Auto-generated audit of pages, components, mocks, services, types, and utilities.
> Last updated: 2026-03-30

## Table of Contents

- [Overview](#overview)
- [Pages & Layouts](#pages--layouts)
- [Route Components](#route-components)
  - [Accounts](#accounts-route-components)
  - [Budgets](#budgets-route-components)
  - [Dashboard](#dashboard-route-components)
  - [Transactions](#transactions-route-components)
- [Shared Components](#shared-components)
  - [Form Components](#form-components)
- [Types](#types)
- [Mock Data](#mock-data)
- [Schemas](#schemas)
- [Utilities](#utilities)
- [Lib — Dates](#lib--dates)
- [Backup HTML Prototypes](#backup-html-prototypes)
- [Key Observations](#key-observations)

---

## Overview

| Aspect            | Detail                                                  |
| ----------------- | ------------------------------------------------------- |
| Framework         | Next.js (App Router)                                    |
| Styling           | Tailwind CSS                                            |
| Form library      | react-hook-form + zod                                   |
| Date library      | date-fns / date-fns-tz                                  |
| API integration   | **None yet** — all data sourced from local mock modules |
| Client components | 7 files use `"use client"`                              |

---

## Pages & Layouts

| Route               | File                                  | Exports                                      | Data Consumed                                                              |
| ------------------- | ------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------- |
| `/`                 | `app/page.tsx`                        | default `Home`                               | `redirect` from next/navigation (redirects into app)                       |
| Root layout         | `app/layout.tsx`                      | `viewport`, `metadata`, default `RootLayout` | next/font/google, globals.css                                              |
| App shell           | `app/(app)/layout.tsx`                | default `AppLayout`                          | `Sidebar`, `BottomNav`                                                     |
| Dashboard layout    | `app/(app)/dashboard/layout.tsx`      | default `DashboardLayout`                    | `Header`, `ButtonLink`, `formatDate`, `getCurrentDate`                     |
| `/dashboard`        | `app/(app)/dashboard/page.tsx`        | default `Dashboard`                          | Route components: `Transactions`, `Budgets`                                |
| `/accounts`         | `app/(app)/accounts/page.tsx`         | default `AccountsPage`                       | `MOCK_ACCOUNTS`, `AccountList`, `RecentTransactions`                       |
| `/accounts/[id]`    | `app/(app)/accounts/[id]/page.tsx`    | default async `AccountDetailPage`            | `MOCK_ACCOUNTS` (lookup by `params.id`), `notFound`, `ACCOUNT_TYPE_LABELS` |
| `/budgets`          | `app/(app)/budgets/page.tsx`          | default `BudgetsPage`                        | `MOCK_BUDGETS`, `BudgetSummary`, `BudgetCard`, `BudgetAlerts`              |
| `/budgets/new`      | `app/(app)/budgets/new/page.tsx`      | default `NewBudgetPage`                      | `NewBudgetContainer`                                                       |
| `/budgets/[id]`     | `app/(app)/budgets/[id]/page.tsx`     | default async `BudgetDetailPage`             | `MOCK_BUDGETS` (lookup by `params.id`), `notFound`                         |
| `/transactions`     | `app/(app)/transactions/page.tsx`     | default `TransactionsPage`                   | `MOCK_TRANSACTIONS`, `TransactionsContent`, `SummaryPanel`                 |
| `/transactions/new` | `app/(app)/transactions/new/page.tsx` | default `NewTransactionPage`                 | `NewTransactionContainer`                                                  |

---

## Route Components

### Accounts Route Components

| File                                               | Export                        | Props                                 | Client  | Hooks      | Data Dependencies                                                                                     |
| -------------------------------------------------- | ----------------------------- | ------------------------------------- | ------- | ---------- | ----------------------------------------------------------------------------------------------------- |
| `accounts/components/AccountCard.tsx`              | default `AccountCard`         | `{ account: Account; index: number }` | No      | —          | `ACCOUNT_TYPE_LABELS`, `ACCOUNT_TYPE_COLORS`, `formatAmount`                                          |
| `accounts/components/AccountList.tsx`              | default `AccountList`         | `{ accounts: Account[] }`             | No      | —          | `AccountCard`                                                                                         |
| `accounts/components/RecentTransactions.tsx`       | default `RecentTransactions`  | none                                  | No      | —          | `MOCK_TRANSACTIONS`, `TransactionItem`                                                                |
| `accounts/[id]/components/AccountHero.tsx`         | default `AccountHero`         | `{ account: Account }`                | No      | —          | `ACCOUNT_TYPE_LABELS`, `ACCOUNT_TYPE_COLORS`, `formatAmount`                                          |
| `accounts/[id]/components/AccountInfo.tsx`         | default `AccountInfo`         | `{ account: Account }`                | No      | —          | `ACCOUNT_TYPE_LABELS`, `formatDate`                                                                   |
| `accounts/[id]/components/AccountActions.tsx`      | default `AccountActions`      | none                                  | No      | —          | `next/link` only                                                                                      |
| `accounts/[id]/components/AccountTransactions.tsx` | default `AccountTransactions` | `{ account: Account }`                | **Yes** | `useState` | `MOCK_TRANSACTIONS`, `getDateGroupLabel`, `groupTransactionsByDate`, `TransactionItem`, `FilterChips` |

### Budgets Route Components

| File                                             | Export                                      | Props                                                                                       | Client  | Hooks     | Data Dependencies                                                                      |
| ------------------------------------------------ | ------------------------------------------- | ------------------------------------------------------------------------------------------- | ------- | --------- | -------------------------------------------------------------------------------------- |
| `budgets/components/BudgetAlerts.tsx`            | default `BudgetAlerts`                      | `{ budgets: Budget[] }`                                                                     | No      | —         | `formatAmount`                                                                         |
| `budgets/components/BudgetCard.tsx`              | default `BudgetCard`                        | `{ budget: Budget }`                                                                        | No      | —         | `formatAmount`, `percentMinMax`, `getBudgetStatus`                                     |
| `budgets/components/BudgetSummary.tsx`           | default `BudgetSummary`                     | `{ budgets: Budget[] }`                                                                     | No      | —         | `formatAmount`                                                                         |
| `budgets/[id]/components/BudgetHero.tsx`         | default `BudgetHero`                        | `{ budget: Budget }`                                                                        | No      | —         | `formatAmount`, `getBudgetStatus`                                                      |
| `budgets/[id]/components/BudgetInfo.tsx`         | default `BudgetInfo`                        | `{ budget: Budget }`                                                                        | No      | —         | `BUDGET_COLOR_CLASSES`, `formatAmount`                                                 |
| `budgets/[id]/components/BudgetTransactions.tsx` | default `BudgetTransactions`                | `{ budget: Budget }`                                                                        | No      | —         | `MOCK_TRANSACTIONS`, `getDateGroupLabel`, `groupTransactionsByDate`, `TransactionItem` |
| `budgets/new/components/NewBudgetContainer.tsx`  | default `NewBudgetContainer`                | none                                                                                        | **Yes** | `useForm` | `budgetSchema`, `BudgetForm`, `BudgetPreview`, `SaveButton`                            |
| `budgets/new/components/BudgetForm.tsx`          | default `BudgetForm`                        | `{ register, errors, control, selectedEmoji, onEmojiChange, selectedColor, onColorChange }` | No      | —         | `CATEGORY_NAMES`, form inputs, `EmojiPicker`, `ColorPicker`                            |
| `budgets/new/components/BudgetPreview.tsx`       | default `BudgetPreview`, named `SaveButton` | `{ name, emoji, color, category, amount }`                                                  | No      | —         | `BUDGET_COLOR_CLASSES`, `formatAmount`                                                 |
| `budgets/new/components/ColorPicker.tsx`         | default `ColorPicker`                       | `{ selectedColor: BudgetColor; onColorChange }`                                             | No      | —         | `BUDGET_COLOR_CLASSES`                                                                 |
| `budgets/new/components/EmojiPicker.tsx`         | default `EmojiPicker`                       | `{ selectedEmoji; onEmojiChange }`                                                          | No      | —         | none                                                                                   |

### Dashboard Route Components

| File                                    | Export                 | Props                | Client | Hooks | Data Dependencies                      |
| --------------------------------------- | ---------------------- | -------------------- | ------ | ----- | -------------------------------------- |
| `dashboard/components/Transactions.tsx` | default `Transactions` | none                 | No     | —     | `MOCK_TRANSACTIONS`, `TransactionItem` |
| `dashboard/components/Budgets.tsx`      | default `Budgets`      | none                 | No     | —     | `MOCK_BUDGETS`, `BudgetItem`           |
| `dashboard/components/BudgetItem.tsx`   | default `BudgetItem`   | `{ budget: Budget }` | No     | —     | `formatAmount`, `getBudgetStatus`      |

### Transactions Route Components

| File                                                      | Export                                    | Props                                                       | Client  | Hooks      | Data Dependencies                                                                                         |
| --------------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------- | ------- | ---------- | --------------------------------------------------------------------------------------------------------- |
| `transactions/components/TransactionsContent.tsx`         | default `TransactionsContent`             | `{ transactions: Transaction[] }`                           | **Yes** | `useState` | `FilterChips`, `TransactionList`                                                                          |
| `transactions/components/TransactionList.tsx`             | default `TransactionList`                 | `{ transactions: Transaction[] }`                           | No      | —          | `getDateGroupLabel`, `groupTransactionsByDate`, `TransactionItem`                                         |
| `transactions/components/SummaryPanel.tsx`                | default `SummaryPanel`                    | `{ transactions: Transaction[] }`                           | No      | —          | `TRANSACTION_TYPES`, `CATEGORY_STYLES`, `CATEGORY_NAMES`, `formatAmount`, `getCurrentMonthName`           |
| `transactions/components/FilterChips.tsx`                 | default `FilterChips`                     | `{ activeFilter: TransactionKind \| null; onFilterChange }` | No      | —          | `TRANSACTION_TYPES`                                                                                       |
| `transactions/new/components/NewTransactionContainer.tsx` | default `NewTransactionContainer`         | none                                                        | **Yes** | `useForm`  | `transactionSchema`, `getCurrentDateTime`, `parseDateTimeFields`, `TRANSACTION_TYPES`                     |
| `transactions/new/components/TransactionForm.tsx`         | default `TransactionForm`                 | `{ selectedType, register, errors }`                        | No      | —          | `MOCK_ACCOUNT_OPTIONS`, `CATEGORY_NAMES`, `TRANSACTION_TYPES`, form inputs                                |
| `transactions/new/components/TypeSelector.tsx`            | default `TransactionTypeSelector`         | `{ selectedType; setSelectedType }`                         | No      | —          | `TRANSACTION_TYPES`, `TRANSACTION_TYPE_COLORS`, `TypeSelectorButton`                                      |
| `transactions/new/components/TypeSelectorButton.tsx`      | default `TypeSelectorButton`              | `{ isSelected, onClick, children, className? }`             | No      | —          | none                                                                                                      |
| `transactions/new/components/AmountInput.tsx`             | default `AmountInput`                     | `{ control, error? }`                                       | **Yes** | —          | `@/components/forms/AmountInput` (wraps shared)                                                           |
| `transactions/new/components/LivePreview.tsx`             | default `LivePreview`, named `SaveButton` | `{ selectedType, control }`                                 | **Yes** | `useWatch` | `formatDate`, `parseDateTimeFields`, `formatAmount`, `TRANSACTION_TYPE_LABELS`, `TRANSACTION_TYPE_COLORS` |

---

## Shared Components

| File                             | Export                    | Props                                                                   | Client                                | Hooks         |
| -------------------------------- | ------------------------- | ----------------------------------------------------------------------- | ------------------------------------- | ------------- |
| `components/Header.tsx`          | default `Header`          | `{ title, subTitle?, children? }`                                       | No                                    | —             |
| `components/ButtonLink.tsx`      | default `ButtonLink`      | `{ icon?, text, link, transparent?, bgColor?, textColor?, className? }` | No                                    | —             |
| `components/Sidebar.tsx`         | default `Sidebar`         | none                                                                    | **Yes** (inferred from `usePathname`) | `usePathname` |
| `components/BottomNav.tsx`       | default `BottomNav`       | none                                                                    | **Yes** (inferred from `usePathname`) | `usePathname` |
| `components/TransactionItem.tsx` | default `TransactionItem` | `{ transaction: Transaction }`                                          | No                                    | —             |

### Form Components

| File                                 | Export                   | Props                                                                           |
| ------------------------------------ | ------------------------ | ------------------------------------------------------------------------------- |
| `components/forms/AmountInput.tsx`   | default `AmountInput<T>` | `{ control, error?, label? }` — uses `useController`, `useState`, `useEffect`   |
| `components/forms/FieldError.tsx`    | default `FieldError`     | `{ message? }`                                                                  |
| `components/forms/InputDate.tsx`     | default `InputDate`      | `{ id, label, className?, registration?, error? }`                              |
| `components/forms/InputSelect.tsx`   | default `InputSelect`    | `{ id, label, className?, options?, firstOption?, registration?, error? }`      |
| `components/forms/InputText.tsx`     | default `InputText`      | `{ id, label, placeholder?, className?, autoComplete?, registration?, error? }` |
| `components/forms/InputTextArea.tsx` | default `InputTextArea`  | `{ id, label, placeholder?, className?, rows?, registration?, error? }`         |
| `components/forms/InputTime.tsx`     | default `InputTime`      | `{ id, label, className?, registration?, error? }`                              |

---

## Types

### `types/Account.types.ts`

```ts
type AccountKind = 'BANK' | 'CASH' | 'CREDIT_CARD' | ...  // re-exported
type Account = {
  id: string;
  name: string;
  type: AccountKind;
  balance: number;
  user_id?: string;
  createdAt: string;
  updatedAt: string;
}
```

### `types/Transaction.types.ts`

```ts
type TransactionKind = "EXPENSE" | "INCOME" | "TRANSFER"; // re-exported
type Transaction = TransferTransaction | IncomeTransaction | ExpenseTransaction;
// Union discriminated by `type` field; each variant has shared fields
// (id, description, amount, date, account_id, note?, type) plus variant-specific fields
```

### `types/Budget.type.ts`

```ts
type BudgetColor = "rose" | "blue" | "emerald" | "amber" | "violet" | "cyan";
type Budget = {
  id: string;
  name: string;
  emoji: string;
  color: BudgetColor;
  category: string;
  amount: number;
  spent: number;
};
```

---

## Mock Data

| File                            | Export                 | Shape                | Records                                                    |
| ------------------------------- | ---------------------- | -------------------- | ---------------------------------------------------------- |
| `lib/mock/accounts.mock.ts`     | `MOCK_ACCOUNTS`        | `Account[]`          | Array of account objects with id, name, type, balance      |
| `lib/mock/accounts.mock.ts`     | `MOCK_ACCOUNT_OPTIONS` | `{ value, label }[]` | Derived options array for select inputs                    |
| `lib/mock/budgets.mock.ts`      | `MOCK_BUDGETS`         | `Budget[]`           | Array with id, name, emoji, color, category, amount, spent |
| `lib/mock/transactions.mock.ts` | `MOCK_TRANSACTIONS`    | `Transaction[]`      | Mixed EXPENSE / INCOME / TRANSFER records                  |

**Consumers of mocks (direct imports):**

| Mock                   | Consumed by                                                                                                                                                                                                          |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MOCK_ACCOUNTS`        | `accounts/page.tsx`, `accounts/[id]/page.tsx`                                                                                                                                                                        |
| `MOCK_ACCOUNT_OPTIONS` | `transactions/new/components/TransactionForm.tsx`                                                                                                                                                                    |
| `MOCK_BUDGETS`         | `budgets/page.tsx`, `dashboard/components/Budgets.tsx`                                                                                                                                                               |
| `MOCK_TRANSACTIONS`    | `transactions/page.tsx`, `accounts/components/RecentTransactions.tsx`, `accounts/[id]/components/AccountTransactions.tsx`, `budgets/[id]/components/BudgetTransactions.tsx`, `dashboard/components/Transactions.tsx` |

---

## Schemas

### `lib/schemas/transaction.schema.ts`

| Export                  | Description                                                                                                      |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `transactionSchema`     | Zod discriminated union by `type` (EXPENSE / INCOME / TRANSFER). Validates amount, date, account, category, etc. |
| `TransactionFormData`   | Inferred type from the zod schema (discriminated union)                                                          |
| `TransactionFormFields` | Flat form type used by react-hook-form (all fields optional-friendly)                                            |

### `lib/schemas/budget.schema.ts`

| Export             | Description                                                                                                           |
| ------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `budgetSchema`     | Zod object: name, emoji, color (BudgetColor enum), category (CATEGORY_NAMES enum), amount (positive), note (optional) |
| `BudgetFormFields` | Inferred type from the zod schema                                                                                     |

---

## Utilities

### `utils/utils.ts`

| Export          | Signature                                               | Purpose             |
| --------------- | ------------------------------------------------------- | ------------------- |
| `formatAmount`  | `(amount: number) => string`                            | Currency formatting |
| `percentMinMax` | `(value: number, min?: number, max?: number) => number` | Clamp percentage    |

### `utils/constants.ts`

| Export                    | Type                          | Purpose                                       |
| ------------------------- | ----------------------------- | --------------------------------------------- |
| `TransactionKind`         | type                          | `'EXPENSE' \| 'INCOME' \| 'TRANSFER'`         |
| `AccountKind`             | type                          | Account type enum                             |
| `TRANSACTION_TYPES`       | object                        | `{ EXPENSE, INCOME, TRANSFER }` labels/config |
| `ACCOUNT_TYPES`           | object                        | Account type enum values                      |
| `ACCOUNT_TYPE_LABELS`     | `Record<AccountKind, string>` | Display labels                                |
| `ACCOUNT_TYPE_COLORS`     | `Record<AccountKind, string>` | Tailwind color classes                        |
| `TRANSACTION_TYPE_LABELS` | record                        | Display labels per kind                       |
| `TRANSACTION_TYPE_COLORS` | record                        | Color classes per kind                        |
| `CATEGORY_NAMES`          | object                        | Category name enum values                     |
| `CATEGORY_STYLES`         | record                        | Icon/color per category                       |
| `DEFAULT_CATEGORY_STYLE`  | `CategoryStyle`               | Fallback style                                |
| `BUDGET_COLOR_CLASSES`    | record                        | Color classes per BudgetColor                 |
| `Category`                | type                          | Category string union                         |
| `CategoryStyle`           | type                          | `{ icon, bg, text }`                          |

### `utils/navigation.ts`

| Export             | Purpose                                                   |
| ------------------ | --------------------------------------------------------- |
| `NavItem`          | type: `{ label, href, icon }`                             |
| `NAV_ITEMS`        | Sidebar nav items array                                   |
| `BOTTOM_NAV_ITEMS` | Mobile bottom nav items array                             |
| `getActiveHref`    | `(pathname: string) => string` — resolves active nav item |

### `utils/budget.utils.ts`

| Export              | Purpose                                                             |
| ------------------- | ------------------------------------------------------------------- |
| `BudgetStatusLabel` | type                                                                |
| `BudgetStatus`      | type: `{ progress, label, badge, colors }`                          |
| `getBudgetStatus`   | `(budget: Budget) => BudgetStatus` — computes progress/status badge |

### `utils/transaction.groups.ts`

| Export                    | Purpose                                                                                      |
| ------------------------- | -------------------------------------------------------------------------------------------- |
| `groupTransactionsByDate` | `(transactions: Transaction[]) => Map<string, Transaction[]>` — sorts and groups by date key |

### `utils/transaction.utils.ts`

| Export                   | Purpose                                                   |
| ------------------------ | --------------------------------------------------------- |
| `getTransactionSubtitle` | `(transaction: Transaction) => string` — subtitle by type |

---

## Lib — Dates

### `lib/dates/index.ts`

| Export                    | Purpose                                   |
| ------------------------- | ----------------------------------------- |
| `DATE_FORMATS`            | Named format strings                      |
| `DateFormat`, `DateInput` | Types                                     |
| `formatDate`              | Format a date value to string             |
| `formatDateCustom`        | Format with custom pattern                |
| `toISODate`               | Convert to ISO date string                |
| `formatTime`              | Format time portion                       |
| `formatDuration`          | Format a duration                         |
| `getCurrentDate`          | Current date string                       |
| `getCurrentTime`          | Current time string                       |
| `getCurrentDateTime`      | Current date + time                       |
| `getCurrentMonthName`     | Current month display name                |
| `parseDateTimeFields`     | Parse separate date/time fields into Date |
| `getDateGroupLabel`       | Display label for a date group key        |
| `getDateGroupKey`         | Compute grouping key from a date          |

Dependencies: `date-fns`, `date-fns-tz`, `NEXT_PUBLIC_APP_TIMEZONE` env var.

---

## Backup HTML Prototypes

Static HTML mockups in `app/backup/` (no module exports, Tailwind CDN):

| File                                | Screen                |
| ----------------------------------- | --------------------- |
| `01-dashboard.html`                 | Dashboard             |
| `02-nueva-transaccion.html`         | New transaction       |
| `03-cuentas.html`                   | Accounts list         |
| `04-movimientos.html`               | Transactions list     |
| `05-budgets.html`                   | Budgets overview      |
| `06-reportes.html`                  | Reports               |
| `07-budget-form.html`               | Budget form           |
| `07-nueva-transaccion.html`         | New transaction (alt) |
| `08-account-detail.html`            | Account detail        |
| `finanzas_personales_ui_guide.html` | UI style guide        |

---

## Key Observations

1. **No API integration exists.** Every page reads from local mock arrays. Replacing mocks with `fetch`/service calls is the main integration task.
2. **7 client components** use `"use client"`: `AccountTransactions`, `TransactionsContent`, `NewBudgetContainer`, `NewTransactionContainer`, `AmountInput` (transaction wrapper), `LivePreview`, and the two nav components (`Sidebar`, `BottomNav`).
3. **Forms** use `react-hook-form` with `zod` resolvers. Two schemas exist: `transactionSchema` (discriminated union) and `budgetSchema`.
4. **No services layer** (fetch wrappers, API clients) has been created yet.
5. **No auth/session handling** exists on the frontend.
6. **No error boundaries or loading states** are implemented.
7. **Reports page** exists only as an HTML prototype (`06-reportes.html`) with no corresponding Next.js route.
