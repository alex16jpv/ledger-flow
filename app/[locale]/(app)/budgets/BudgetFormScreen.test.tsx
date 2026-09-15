import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ToastProvider } from "@/components/ui/Toast";
import { QueryProvider } from "@/lib/query/QueryProvider";
import { drawOf } from "@/lib/testing/colors";
import { renderWithProviders } from "@/lib/testing/render";
import type { Category } from "@/types/api";

import { NewBudgetScreen } from "./BudgetFormScreen";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("") }));
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/budgets/new",
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, ...init });
const fetchMock = vi.fn<typeof fetch>();

const food: Category = {
  id: "food",
  name: "Food",
  icon: "utensils",
  color: "ORANGE",
  type: "EXPENSE",
  userId: "u1",
  archivedAt: null,
  createdAt: "",
  updatedAt: "",
};

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((input, init) =>
    Promise.resolve(
      init?.method === "POST" ? json({ id: "b1" }, { status: 201 }) : json({ data: [food] }),
    ),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("NewBudgetScreen", () => {
  it("opens on a drawn colour and creates the budget with it (T-74)", async () => {
    vi.spyOn(Math, "random").mockReturnValue(drawOf("ROSE"));
    renderWithProviders(
      <QueryProvider>
        <ToastProvider>
          <NewBudgetScreen />
        </ToastProvider>
      </QueryProvider>,
    );
    const group = await screen.findByRole("group", { name: "Color" });
    expect(
      within(group)
        .getAllByRole("button", { pressed: true })
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual(["Rose"]);
    await userEvent.type(screen.getByLabelText("Name"), "Everything");
    await userEvent.click(screen.getByRole("button", { name: "All spending" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Amount" }), "650000");
    await userEvent.click(screen.getByRole("button", { name: "Create budget" }));
    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(true);
    });
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(JSON.parse(post?.[1]?.body as string)).toMatchObject({ color: "ROSE" });
  });
});
