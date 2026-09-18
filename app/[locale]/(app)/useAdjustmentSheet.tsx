"use client";

import dynamic from "next/dynamic";
import { type ReactNode, useState } from "react";

import type { Transaction } from "@/types/api";

const EditAdjustmentSheet = dynamic(() =>
  import("./AdjustBalanceSheet").then((module) => module.EditAdjustmentSheet),
);

export interface AdjustmentSheet {
  // True when the row was an adjustment and this sheet took it, so the caller does not navigate.
  opened: (transaction: Transaction) => boolean;
  sheet: ReactNode;
}

export function useAdjustmentSheet(): AdjustmentSheet {
  const [editing, setEditing] = useState<Transaction | null>(null);

  return {
    opened: (transaction) => {
      if (transaction.type !== "ADJUSTMENT") return false;
      setEditing(transaction);
      return true;
    },
    sheet: editing && (
      <EditAdjustmentSheet
        adjustment={editing}
        open
        onClose={() => {
          setEditing(null);
        }}
      />
    ),
  };
}
