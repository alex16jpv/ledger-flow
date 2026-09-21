export interface SharedExpenseLookup {
  yourShare: number;
  groupId: string;
  groupName: string;
}

export interface SharedPaymentLookup {
  name: string;
  groups: string[];
}

// What a movement's own row needs of the shared layer, so neither feature reads the other.
export interface SharedLookup {
  expenses: ReadonlyMap<string, SharedExpenseLookup>;
  payments: ReadonlyMap<string, SharedPaymentLookup>;
}
