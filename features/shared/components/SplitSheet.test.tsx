import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ToastProvider } from "@/components/ui/Toast";
import { QueryProvider } from "@/lib/query/QueryProvider";
import { json } from "@/lib/testing/http";
import { renderWithProviders } from "@/lib/testing/render";
import type { SharedShare } from "@/types/api";

import { type SplitResult, SplitSheet } from "./SplitSheet";

const ANA = "k1";
const BETO = "k2";
const fetchMock = vi.fn<typeof fetch>();

vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/shared",
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockImplementation(() =>
    Promise.resolve(
      json({
        data: [],
        pagination: { limit: 20, offset: 0, total: 0, hasMore: false, nextCursor: null },
      }),
    ),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const people = [
  { contactId: null, name: "You", color: null },
  { contactId: ANA, name: "Ana Ruiz", color: null },
  { contactId: BETO, name: "Beto Cano", color: null },
];

function open(onSave: (result: SplitResult) => void = vi.fn()) {
  renderWithProviders(
    <QueryProvider>
      <ToastProvider>
        <SplitSheet
          open
          onClose={vi.fn()}
          title="Split $100,000 · Food"
          total={100_000}
          currency="COP"
          people={people}
          payerContactId={null}
          saveLabel="Save split"
          onSave={onSave}
        />
      </ToastProvider>
    </QueryProvider>,
  );
}

const amountOf = (name: string) => screen.getByRole("textbox", { name: `What ${name} pays` });

describe("SplitSheet", () => {
  // T-67: $100,000 does not divide by three, and the odd peso is not anybody's to lose.
  it("opens equal, with the odd unit on whoever paid, and saves the shares it shows", async () => {
    const onSave = vi.fn();
    open(onSave);

    expect(screen.getByText("Left to assign")).toBeInTheDocument();
    expect(amountOf("You")).toHaveValue("$33,334");
    expect(amountOf("Ana Ruiz")).toHaveValue("$33,333");

    await userEvent.click(screen.getByRole("button", { name: "Save split" }));
    const [result] = onSave.mock.calls[0] as [SplitResult];
    expect(result.shares.map((share: SharedShare) => share.amount)).toEqual([
      33_334, 33_333, 33_333,
    ]);
  });

  it("will not save an exact split that does not add up, and says which way it is wrong", async () => {
    open();

    await userEvent.click(screen.getByRole("button", { name: "Exact" }));
    await userEvent.type(amountOf("You"), "60000");
    await userEvent.type(amountOf("Ana Ruiz"), "20000");
    await userEvent.type(amountOf("Beto Cano"), "30000");

    expect(screen.getByText("The shares add up to more than the expense.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save split" })).toBeDisabled();
  });

  // Decision 20: the guests weigh as many shares as there are of them, and pay as one row.
  it("counts a block of guests as its head count", async () => {
    open();

    await userEvent.click(screen.getByRole("button", { name: "Add guests" }));
    const count = screen.getByRole("textbox", { name: "How many guests" });
    await userEvent.clear(count);
    await userEvent.type(count, "7");

    expect(screen.getByText(/3 people \+ 7 guests/)).toBeInTheDocument();
    expect(amountOf("You")).toHaveValue("$10,000");
    expect(screen.getByText("Guests · 7")).toBeInTheDocument();
  });
});
