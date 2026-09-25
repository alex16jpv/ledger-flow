import { render, screen } from "@testing-library/react";
import { useState } from "react";

import { EditTransactionRoute } from "./DetailRoute";

let pathname = "/transactions/0190a1b2-0000-7000-8000-000000000001/edit";
vi.mock("@/lib/i18n/navigation", () => ({ usePathname: () => pathname }));

let mounts = 0;
vi.mock("../../TransactionFormScreen", () => ({
  EditTransactionScreen: ({ id }: { id: string }) => {
    const [first] = useState(() => {
      mounts += 1;
      return id;
    });
    return <p>{`${first} mount ${mounts}`}</p>;
  },
}));

// T-195: one cached payload serves every row, so only the key tells two rows' forms apart.
it("mounts a fresh screen when the row in the address changes", () => {
  const { rerender } = render(<EditTransactionRoute />);
  expect(screen.getByText("0190a1b2-0000-7000-8000-000000000001 mount 1")).toBeInTheDocument();

  pathname = "/transactions/0190a1b2-0000-7000-8000-000000000002/edit";
  rerender(<EditTransactionRoute />);
  expect(screen.getByText("0190a1b2-0000-7000-8000-000000000002 mount 2")).toBeInTheDocument();
});
