import { screen } from "@testing-library/react";

import { ToastProvider } from "@/components/ui/Toast";
import { QueryProvider } from "@/lib/query/QueryProvider";
import { json, urlOf } from "@/lib/testing/http";
import { renderWithProviders } from "@/lib/testing/render";

import { NewTransactionRoute } from "./NewTransactionRoute";

let search = "";
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/transactions/new",
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(search),
}));

const fetchMock = vi.fn<typeof fetch>();
const page = (data: unknown[]) =>
  json({
    data,
    pagination: { limit: 100, offset: 0, total: data.length, hasMore: false, nextCursor: null },
  });

beforeEach(() => {
  fetchMock.mockReset();
  search = "";
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockImplementation((input) =>
    Promise.resolve(
      urlOf(input).endsWith("/api/transactions/tags") ? json({ data: [] }) : page([]),
    ),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function view() {
  renderWithProviders(
    <QueryProvider>
      <ToastProvider>
        <NewTransactionRoute />
      </ToastProvider>
    </QueryProvider>,
  );
}

describe("NewTransactionRoute", () => {
  it("is the plain form with no group in the query string", async () => {
    search = "amount=4500";
    view();

    expect(await screen.findByRole("group", { name: "Type" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Save transaction" })).toBeVisible();
  });

  // An empty `group=` is no group: the form it would open has nothing to record into.
  it("is the plain form when the group is empty", async () => {
    search = "group=";
    view();

    expect(await screen.findByRole("group", { name: "Type" })).toBeVisible();
  });

  it("is the group's form when the query string names one", async () => {
    search = "group=g1";
    view();

    expect(await screen.findByText("This shared group doesn’t exist.")).toBeVisible();
    expect(screen.queryByRole("group", { name: "Type" })).not.toBeInTheDocument();
  });
});
