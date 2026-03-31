# API Endpoints Reference

> Base URL: `/` · All endpoints except **Auth** require a `Bearer` JWT token in the `Authorization` header.
> Rate limit: **100 requests / 15 min** per IP (all routes).

---

## Table of Contents

| Module | Prefix | Auth |
|---|---|---|
| [Health](#health) | `/` | No |
| [Auth](#auth) | `/auth` | No |
| [Users](#users) | `/users` | Yes |
| [Accounts](#accounts) | `/accounts` | Yes |
| [Categories](#categories) | `/categories` | Yes |
| [Transactions](#transactions) | `/transactions` | Yes |

---

## Common Shapes

### Pagination Parameters (query)

| Param | Type | Default | Description |
|---|---|---|---|
| `limit` | `integer` (1–100) | `20` | Max items to return |
| `offset` | `integer` (≥ 0) | `0` | Items to skip (offset-based) |
| `cursor` | `string (uuid)` | — | Cursor ID (overrides `offset`) |

### Paginated Response Envelope

```jsonc
{
  "data": [ /* array of resource objects */ ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 100,
    "hasMore": true,
    "nextCursor": "uuid | null"
  }
}
```

### Error Responses

**Validation Error (400)**

```json
{
  "error": "ValidationError",
  "message": "Invalid request data",
  "details": [
    { "field": "body.name", "message": "Name is required" }
  ]
}
```

**API Error (400 / 401 / 403 / 404 / 422)**

```json
{
  "error": "NotFoundError",
  "message": "Account not found"
}
```

**Conflict Error (409)** — duplicate unique values

```json
{
  "error": "ConflictError",
  "message": "email must be unique"
}
```

**Rate Limit (429)**

```json
{
  "error": "TooManyRequests",
  "message": "Too many requests, please try again later"
}
```

**Internal Server Error (500)**

```json
{
  "error": "InternalServerError",
  "message": "An unexpected error occurred"
}
```

---

## Health

### `GET /`

Health-check / root probe.

- **Auth:** None
- **Response `200`:**

```json
{ "hello": "world!" }
```

---

## Auth

### `POST /auth/register`

Register a new user.

- **Auth:** None
- **Request Body:**

| Field | Type | Required | Constraints |
|---|---|---|---|
| `name` | `string` | ✅ | 1–255 chars |
| `email` | `string` | ✅ | Valid email, max 255 |
| `password` | `string` | ✅ | 8–128 chars |

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securePass1"
}
```

- **Response `201`:** [User](#user-object)
- **Errors:** `400` validation, `409` duplicate email

---

### `POST /auth/login`

Authenticate and obtain a JWT token.

- **Auth:** None
- **Request Body:**

| Field | Type | Required | Constraints |
|---|---|---|---|
| `email` | `string` | ✅ | Valid email |
| `password` | `string` | ✅ | Non-empty |

```json
{
  "email": "john@example.com",
  "password": "securePass1"
}
```

- **Response `200`:**

```json
{
  "token": "eyJhbGciOi...",
  "user": { /* User object */ }
}
```

- **Errors:** `400` validation, `401` invalid credentials

---

## Users

### `GET /users`

List all users (paginated).

- **Auth:** Bearer
- **Query:** [Pagination params](#pagination-parameters-query)
- **Response `200`:** `PaginatedResult<User>`

---

### `GET /users/:id`

Get a single user by ID.

- **Auth:** Bearer
- **Params:** `id` — UUID
- **Response `200`:** [User](#user-object)
- **Errors:** `400` invalid UUID, `404` not found

---

### `PUT /users/:id`

Update a user. At least one field must be provided.

- **Auth:** Bearer
- **Params:** `id` — UUID
- **Request Body:**

| Field | Type | Required | Constraints |
|---|---|---|---|
| `name` | `string` | — | 1–255 chars |
| `email` | `string` | — | Valid email, max 255 |
| `password` | `string` | — | 8–128 chars |

- **Response `200`:** [User](#user-object)
- **Errors:** `400` validation, `404` not found, `409` duplicate email

---

### `DELETE /users/:id`

Delete a user.

- **Auth:** Bearer
- **Params:** `id` — UUID
- **Response `204`:** No content
- **Errors:** `400` invalid UUID

---

## Accounts

### `GET /accounts`

List all accounts for the authenticated user (paginated).

- **Auth:** Bearer
- **Query:** [Pagination params](#pagination-parameters-query)
- **Response `200`:** `PaginatedResult<Account>`

---

### `POST /accounts`

Create a new account.

- **Auth:** Bearer
- **Request Body:**

| Field | Type | Required | Constraints |
|---|---|---|---|
| `name` | `string` | ✅ | 1–255 chars |
| `type` | `AccountType` | ✅ | See enum below |
| `balance` | `number` | — | Finite number; defaults to `0` |

**`AccountType` enum:** `CASH`, `ACCOUNT`, `CARD`, `DEBIT_CARD`, `SAVINGS`, `INVESTMENT`, `OVERDRAFT`, `LOAN`, `OTHER`

```json
{
  "name": "Savings",
  "type": "SAVINGS",
  "balance": 1000
}
```

- **Response `201`:** [Account](#account-object)
- **Errors:** `400` validation

---

### `GET /accounts/:id`

Get an account by ID.

- **Auth:** Bearer
- **Params:** `id` — UUID
- **Response `200`:** [Account](#account-object)
- **Errors:** `400` invalid UUID, `404` not found

---

### `PUT /accounts/:id`

Update an account. At least one field required.

- **Auth:** Bearer
- **Params:** `id` — UUID
- **Request Body:**

| Field | Type | Required | Constraints |
|---|---|---|---|
| `name` | `string` | — | 1–255 chars |
| `type` | `AccountType` | — | See enum above |

- **Response `200`:** [Account](#account-object)
- **Errors:** `400` validation, `404` not found

---

### `DELETE /accounts/:id`

Delete an account.

- **Auth:** Bearer
- **Params:** `id` — UUID
- **Response `204`:** No content
- **Errors:** `400` invalid UUID

---

## Categories

### `GET /categories`

List all categories for the authenticated user (paginated).

- **Auth:** Bearer
- **Query:** [Pagination params](#pagination-parameters-query)
- **Response `200`:** `PaginatedResult<Category>`

---

### `POST /categories`

Create a new category.

- **Auth:** Bearer
- **Request Body:**

| Field | Type | Required | Constraints |
|---|---|---|---|
| `name` | `string` | ✅ | 1–255 chars |
| `emoji` | `string` | — | Single emoji character, max 8 chars |

```json
{ "name": "Food", "emoji": "🍔" }
```

- **Response `201`:** [Category](#category-object)
- **Errors:** `400` validation

---

### `GET /categories/:id`

Get a category by ID.

- **Auth:** Bearer
- **Params:** `id` — UUID
- **Response `200`:** [Category](#category-object)
- **Errors:** `400` invalid UUID, `404` not found

---

### `PUT /categories/:id`

Update a category. At least one field required.

- **Auth:** Bearer
- **Params:** `id` — UUID
- **Request Body:**

| Field | Type | Required | Constraints |
|---|---|---|---|
| `name` | `string` | — | 1–255 chars |
| `emoji` | `string` | — | Single emoji character, max 8 chars |

- **Response `200`:** [Category](#category-object)
- **Errors:** `400` validation, `404` not found

---

### `DELETE /categories/:id`

Delete a category.

- **Auth:** Bearer
- **Params:** `id` — UUID
- **Response `204`:** No content
- **Errors:** `400` invalid UUID

---

## Transactions

### `GET /transactions`

List transactions for the authenticated user (paginated, filterable).

- **Auth:** Bearer
- **Query:**

| Param | Type | Default | Description |
|---|---|---|---|
| `limit` | `integer` (1–100) | `20` | Max items |
| `offset` | `integer` (≥ 0) | `0` | Items to skip |
| `cursor` | `string (uuid)` | — | Cursor |
| `accountId` | `string (uuid)` | — | Filter by account (matches `fromAccountId` or `toAccountId`) |
| `type` | `TransactionType` | — | Filter: `INCOME`, `EXPENSE`, `TRANSFER` |

- **Response `200`:** `PaginatedResult<Transaction>`

---

### `POST /transactions`

Create a new transaction. Updates account balances accordingly:

- **INCOME** → adds `amount` to `toAccountId` (required)
- **EXPENSE** → subtracts `amount` from `fromAccountId` (required)
- **TRANSFER** → subtracts from `fromAccountId`, adds to `toAccountId` (both required, must differ)

- **Auth:** Bearer
- **Request Body:**

| Field | Type | Required | Constraints |
|---|---|---|---|
| `type` | `TransactionType` | ✅ | `INCOME`, `EXPENSE`, `TRANSFER` |
| `amount` | `number` | ✅ | > 0 |
| `date` | `string` | ✅ | ISO 8601 datetime |
| `categoryId` | `string (uuid)` | — | Nullable |
| `description` | `string` | — | Max 255, nullable |
| `fromAccountId` | `string (uuid)` | conditional | Required for `EXPENSE` and `TRANSFER` |
| `toAccountId` | `string (uuid)` | conditional | Required for `INCOME` and `TRANSFER` |
| `tags` | `string` | — | Max 500, nullable |
| `note` | `string` | — | Max 1000, nullable |

```json
{
  "type": "EXPENSE",
  "amount": 50.00,
  "date": "2026-03-28T12:00:00.000Z",
  "categoryId": "019576a0-d7b6-7d6d-af6a-2b7545f5ac70",
  "description": "Grocery shopping",
  "fromAccountId": "019576a0-d7b6-7d6d-af6a-2b7545f5ac70",
  "tags": "groceries,food",
  "note": "Weekly grocery run"
}
```

- **Response `201`:** [Transaction](#transaction-object)
- **Errors:** `400` validation (including conditional account rules)

---

### `GET /transactions/:id`

Get a transaction by ID.

- **Auth:** Bearer
- **Params:** `id` — UUID
- **Response `200`:** [Transaction](#transaction-object)
- **Errors:** `400` invalid UUID, `404` not found

---

### `PUT /transactions/:id`

Update a transaction. Reverses original balance changes and applies new ones. At least one field required.

- **Auth:** Bearer
- **Params:** `id` — UUID
- **Request Body:**

| Field | Type | Required | Constraints |
|---|---|---|---|
| `type` | `TransactionType` | — | `INCOME`, `EXPENSE`, `TRANSFER` |
| `amount` | `number` | — | > 0 |
| `date` | `string` | — | ISO 8601 datetime |
| `categoryId` | `string (uuid)` | — | Nullable |
| `description` | `string` | — | Max 255, nullable |
| `fromAccountId` | `string (uuid)` | — | Nullable |
| `toAccountId` | `string (uuid)` | — | Nullable |
| `tags` | `string` | — | Max 500, nullable |
| `note` | `string` | — | Max 1000, nullable |

- **Response `200`:** [Transaction](#transaction-object)
- **Errors:** `400` validation, `404` not found

---

### `DELETE /transactions/:id`

Delete a transaction. Reverses any balance changes on associated accounts.

- **Auth:** Bearer
- **Params:** `id` — UUID
- **Response `204`:** No content
- **Errors:** `400` invalid UUID, `404` not found

---

## Resource Objects

### User Object

```json
{
  "id": "019576a0-d7b6-7d6d-af6a-2b7545f5ac70",
  "name": "John Doe",
  "email": "john@example.com",
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

### Account Object

```json
{
  "id": "019576a0-d7b6-7d6d-af6a-2b7545f5ac70",
  "name": "Savings",
  "type": "SAVINGS",
  "balance": 1000,
  "userId": "019576a0-d7b6-7d6d-af6a-2b7545f5ac70"
}
```

### Category Object

```json
{
  "id": "019576a0-d7b6-7d6d-af6a-2b7545f5ac70",
  "name": "Food",
  "emoji": "🍔",
  "userId": "019576a0-d7b6-7d6d-af6a-2b7545f5ac70"
}
```

### Transaction Object

```json
{
  "id": "019576a0-d7b6-7d6d-af6a-2b7545f5ac70",
  "type": "EXPENSE",
  "amount": 50.00,
  "date": "2026-03-28T12:00:00.000Z",
  "categoryId": "019576a0-d7b6-7d6d-af6a-2b7545f5ac70",
  "description": "Grocery shopping",
  "fromAccountId": "019576a0-d7b6-7d6d-af6a-2b7545f5ac70",
  "toAccountId": null,
  "userId": "019576a0-d7b6-7d6d-af6a-2b7545f5ac70",
  "tags": "groceries,food",
  "note": "Weekly grocery run",
  "createdAt": "2026-03-28T12:00:00.000Z",
  "updatedAt": "2026-03-28T12:00:00.000Z"
}
```

---

## Endpoint Summary

| Method | Path | Description | Auth |
|---|---|---|---|
| `GET` | `/` | Health check | No |
| `POST` | `/auth/register` | Register user | No |
| `POST` | `/auth/login` | Login | No |
| `GET` | `/users` | List users | Yes |
| `GET` | `/users/:id` | Get user | Yes |
| `PUT` | `/users/:id` | Update user | Yes |
| `DELETE` | `/users/:id` | Delete user | Yes |
| `GET` | `/accounts` | List accounts | Yes |
| `POST` | `/accounts` | Create account | Yes |
| `GET` | `/accounts/:id` | Get account | Yes |
| `PUT` | `/accounts/:id` | Update account | Yes |
| `DELETE` | `/accounts/:id` | Delete account | Yes |
| `GET` | `/categories` | List categories | Yes |
| `POST` | `/categories` | Create category | Yes |
| `GET` | `/categories/:id` | Get category | Yes |
| `PUT` | `/categories/:id` | Update category | Yes |
| `DELETE` | `/categories/:id` | Delete category | Yes |
| `GET` | `/transactions` | List transactions | Yes |
| `POST` | `/transactions` | Create transaction | Yes |
| `GET` | `/transactions/:id` | Get transaction | Yes |
| `PUT` | `/transactions/:id` | Update transaction | Yes |
| `DELETE` | `/transactions/:id` | Delete transaction | Yes |

**Total: 22 endpoints** (1 health + 2 auth + 4 users + 5 accounts + 5 categories + 5 transactions)
