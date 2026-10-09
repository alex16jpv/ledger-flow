import { type AccountListParams, readAccount, readAccounts } from "@/lib/local/repository";
import type { Account } from "@/types/api";

// O-F4: reads go through the repository (mirror fallback); writes go through the outbox.
export {
  archiveAccount,
  createAccount,
  restoreAccount,
  setDefaultAccount,
  updateAccount,
} from "@/lib/local/outbox";

export function fetchAccounts(params: AccountListParams = {}): Promise<Account[]> {
  return readAccounts(params);
}

export function fetchAccount(id: string): Promise<Account> {
  return readAccount(id);
}
