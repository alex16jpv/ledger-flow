import { type CategoryColor } from "@/utils/constants";
import { type TransactionKind } from "@/utils/constants";

export type Category = {
  id: string;
  name: string;
  emoji?: string;
  color?: CategoryColor;
  type?: TransactionKind;
  userId: string;
};
