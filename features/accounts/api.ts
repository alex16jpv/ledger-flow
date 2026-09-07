import { type AccountListParams, readAccount, readAccounts } from "@/lib/local/repository";
import type { Account, AccountList } from "@/types/api";

// Reads go through the repository, which falls back to the offline mirror; writes go through the
// outbox, which queues the operation with the row and answers from the projection (O-F4).
export {
  archiveAccount,
  createAccount,
  restoreAccount,
  setDefaultAccount,
  updateAccount,
} from "@/lib/local/outbox";

export function fetchAccounts(params: AccountListParams = {}): Promise<AccountList> {
  return readAccounts(params);
}

export function fetchAccount(id: string): Promise<Account> {
  return readAccount(id);
}
