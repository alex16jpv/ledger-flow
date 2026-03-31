import { type AccountKind } from "@/utils/constants";
export type { AccountKind };

export type Account = {
  id: string;
  name: string;
  type: AccountKind;
  balance: number;
  userId: string;
  createdAt?: string;
  updatedAt?: string;
};
