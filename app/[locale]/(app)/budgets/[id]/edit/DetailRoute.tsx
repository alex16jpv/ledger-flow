"use client";

import { useDetailRouteId } from "@/lib/navigation/detail";

import { EditBudgetScreen } from "../../BudgetFormScreen";

// The id comes from the URL, not from `params`: the worker serves this route from one entry per
// template, so the payload cannot know which row it is (F-48).
export function EditBudgetRoute() {
  const id = useDetailRouteId();
  return id ? <EditBudgetScreen id={id} /> : null;
}
