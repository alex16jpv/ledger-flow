import { type AccountKind } from "@/utils/constants";
export type { AccountKind };

export type Account = {
  id: string;
  name: string;
  type: AccountKind;
  balance: number;
  user_id?: string;
  createdAt: Date;
  updatedAt: Date;
};
