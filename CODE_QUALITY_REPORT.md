# Code Quality Audit Report — Ledger Flow

Audit date: 2026-03-31

---

## 1. Function and Component Issues

### 2.1 Components with too many responsibilities

| File | Component | Problem | Recommendation |
|---|---|---|---|
| `app/(app)/accounts/[id]/components/AccountDetailContent.tsx` | `AccountDetailContent` | Fetches account data, manages delete state, handles conditional rendering for loading/error/not-found states, renders header and multiple child sections. ~120 lines. | Extract data fetching into a custom hook (`useAccount`). Extract the delete logic into a separate hook or handler module. |
| `app/(app)/transactions/[id]/edit/components/EditTransactionContainer.tsx` | `EditTransactionContainer` | Fetches transaction + accounts + categories, manages 6+ state variables, handles form submission with date transformation, renders loading/error/form states. ~200 lines. | Extract the multi-resource fetch into a custom hook. Extract form submission logic into a separate function. |
| `app/(app)/transactions/new/components/NewTransactionContainer.tsx` | `NewTransactionContainer` | Fetches accounts and categories, sets up form with complex resolver casting, handles type switching with field resets, handles date transformation on submit. ~130 lines. | Extract account/category options fetching into a shared hook (reused by Edit too). Extract submit transformation logic. |
| `app/(app)/transactions/components/SummaryPanel.tsx` | File contains `MonthlySummary`, `TopCategories`, `QuickAddLink`, and `SummaryPanel` | 4 components in one file. While they are logically related, the file is ~130 lines and harder to navigate. | Extract `MonthlySummary` and `TopCategories` into their own files within the same `components/` directory. `QuickAddLink` could stay since it's trivial. |

### 2.2 Repeated loading/error state pattern

Every data-fetching component (`AccountsContent`, `RecentTransactions`, `BudgetsPageContent`, `CategoriesContent`, `TransactionsPageContent`, `Budgets`, `Transactions`, `AccountTransactions`, `BudgetTransactions`, `AccountDetailContent`, `BudgetDetailContent`, `EditAccountContainer`, `EditCategoryContainer`, `EditTransactionContainer`) repeats the exact same pattern:

```tsx
const [data, setData] = useState(…);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

const fetchData = useCallback(async () => {
  setLoading(true);
  setError(null);
  // ... fetch
  setLoading(false);
}, []);

useEffect(() => { fetchData(); }, [fetchData]);

if (loading) return <SkeletonUI />;
if (error) return <ErrorWithRetry />;
return <ActualContent />;
```

**Recommendation:** Create a generic `useAsyncData<T>` hook or use a data-fetching library (SWR, TanStack Query) to eliminate this ~20 lines of boilerplate from every component.

### 2.3 Duplicate data-fetching logic between New and Edit transaction containers

`NewTransactionContainer` and `EditTransactionContainer` both independently fetch `accountOptions` and `categoryOptions` with the same mapping logic. **Recommendation:** Extract a `useTransactionFormOptions()` hook.

---

## 2. Consistency Issues

### 2.1 Type file naming convention

| File | Pattern |
|---|---|
| `types/Account.types.ts` | Plural `.types.ts` |
| `types/Auth.types.ts` | Plural `.types.ts` |
| `types/Category.types.ts` | Plural `.types.ts` |
| `types/Transaction.types.ts` | Plural `.types.ts` |
| `types/Budget.type.ts` | **Singular** `.type.ts` |

**Recommendation:** Rename `Budget.type.ts` to `Budget.types.ts` for consistency.

### 2.2 Password field not using `InputText` component

In `login/page.tsx` and `register/page.tsx`, the password field is rendered with raw `<input>` + `<label>` + `<FieldError>` instead of using the `InputText` component. All other text fields in these forms use `InputText`.

**Recommendation:** Either create an `InputPassword` component or add a `type` prop to `InputText` so all fields follow the same pattern.

### 2.3 Duplicate `AmountInput` wrapper

| File | Purpose |
|---|---|
| `components/forms/AmountInput.tsx` | The real, generic `AmountInput` component |
| `app/(app)/transactions/new/components/AmountInput.tsx` | A 10-line wrapper that simply re-exports `SharedAmountInput` with narrowed generics |

**Recommendation:** Remove the wrapper and import the shared `AmountInput` directly in `NewTransactionContainer` and `EditTransactionContainer`. The generic type can be passed at the call site.

### 2.4 Inconsistent data-fetching patterns in `useEffect`

| Pattern | Files |
|---|---|
| `useCallback` + `useEffect` with dependency array | `AccountsContent`, `RecentTransactions`, `TransactionsPageContent`, `Budgets`, `Transactions`, `AccountTransactions`, `BudgetTransactions`, `AccountDetailContent`, `BudgetDetailContent`, `EditAccountContainer`, `EditCategoryContainer`, `EditTransactionContainer` |
| Plain `useEffect` with `.then()` (no useCallback) | `NewBudgetContainer`, `NewTransactionContainer` (for account/category options) |

**Recommendation:** Pick one pattern and apply it everywhere. The `useCallback` + `useEffect` pattern is the more robust one. Alternatively, adopt a data-fetching library.

---

## 3. Readability Issues

### 3.1 Complex inline ternaries

| File | Expression | Recommendation |
|---|---|---|
| `app/(app)/budgets/components/BudgetCard.tsx` | `status.isOver ? "text-red-600" : status.percent >= 80 ? "text-amber-600" : "text-teal-600"` | Extract to a variable: `const percentColor = ...` or move to `getBudgetStatus()` return value |
| `app/(app)/transactions/new/components/LivePreview.tsx` | `selectedType === TRANSACTION_TYPES.EXPENSE ? fromAccount : selectedType === TRANSACTION_TYPES.INCOME ? toAccount : null` | Extract to a named variable: `const accountLabel = getAccountLabel(selectedType, fromAccount, toAccount)` |
| `app/(app)/transactions/new/components/LivePreview.tsx` | Nested ternary in `SaveButton` for the button label | Already acceptable at 2 levels, but could be a simple lookup object |
| `app/(app)/budgets/[id]/components/BudgetHero.tsx` | `status.isOver ? { bg: "…", text: "…" } : status.percent >= 80 ? { … } : { … }` | Extract to a helper function or add `statusBadge` to `getBudgetStatus()` return value |
| `app/(app)/budgets/components/BudgetAlerts.tsx` | `const isDanger = alert.type === "danger"` then ternaries for each class | This is actually well-done — the variable extraction is good |

### 3.2 Long submit handlers mixing concerns

| File | Function | Recommendation |
|---|---|---|
| `app/(app)/transactions/new/components/NewTransactionContainer.tsx` | `onSubmit` | The date transformation (`parseDateTimeFields`, `toISOString`), field exclusion (`payer`), and null coercion (`categoryId \|\| null`) are mixed with the service call and navigation. Extract a `buildTransactionPayload(data)` function. |
| `app/(app)/transactions/[id]/edit/components/EditTransactionContainer.tsx` | `onSubmit` | Same exact transformation logic duplicated. Share the `buildTransactionPayload` helper. |

### 3.3 `BudgetDetailContent` calls hooks before early return

In `app/(app)/budgets/[id]/components/BudgetDetailContent.tsx`:

```tsx
const budget = MOCK_BUDGETS.find((b) => b.id === id);
// ... useCallback, useEffect ...
if (!budget) { notFound(); }
```

The `notFound()` call is placed after the hooks, which is correct for React rules-of-hooks. However, it means the component fetches categories even when the budget doesn't exist. **Recommendation:** Since `MOCK_BUDGETS` is static, the check could be done in the parent Server Component page before rendering `BudgetDetailContent`.

---

## Summary

| Category | Count |
|---|---|
| Function/component issues | 6 major, plus a systemic boilerplate duplication across ~14 components |
| Consistency issues | 4 distinct inconsistencies (naming, patterns, components) |
| Readability issues | 4 complex ternary chains, 2 duplicated submit handlers, 1 hook-ordering concern |
