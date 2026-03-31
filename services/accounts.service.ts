import type { ProxyResponse, PaginatedResult } from "@/lib/api/proxy";
import type { Account } from "@/types/Account.types";
import type {
  CreateAccountFormFields,
  UpdateAccountFormFields,
} from "@/lib/schemas/account.schema";

export async function getAccounts(
  params?: Record<string, string>,
): Promise<ProxyResponse<PaginatedResult<Account>>> {
  const query = params ? `?${new URLSearchParams(params)}` : "";
  const res = await fetch(`/api/accounts${query}`);
  return res.json();
}

export async function getAccount(id: string): Promise<ProxyResponse<Account>> {
  const res = await fetch(`/api/accounts/${id}`);
  return res.json();
}

export async function createAccount(
  payload: CreateAccountFormFields,
): Promise<ProxyResponse<Account>> {
  const res = await fetch("/api/accounts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function updateAccount(
  id: string,
  payload: UpdateAccountFormFields,
): Promise<ProxyResponse<Account>> {
  const res = await fetch(`/api/accounts/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function deleteAccount(id: string): Promise<ProxyResponse<null>> {
  const res = await fetch(`/api/accounts/${id}`, {
    method: "DELETE",
  });
  return res.json();
}
