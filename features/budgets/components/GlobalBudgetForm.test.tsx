import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { QueryProvider } from "@/lib/query/QueryProvider";
import { renderWithProviders } from "@/lib/testing/render";

import { GlobalBudgetForm } from "./GlobalBudgetForm";

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, ...init });
const fetchMock = vi.fn<typeof fetch>();
const stats = (total: number) => json({ groupBy: "category", total, buckets: [] });
const posts = () => fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(() => Promise.resolve(stats(0)));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderForm(onDone = vi.fn()) {
  renderWithProviders(
    <QueryProvider>
      <GlobalBudgetForm submitLabel="Create budget" skipLabel="Not now" onDone={onDone} />
    </QueryProvider>,
  );
  return onDone;
}

describe("GlobalBudgetForm", () => {
  it("creates a global MONTHLY budget from a suggestion", async () => {
    fetchMock.mockImplementation((input, init) =>
      Promise.resolve(init?.method === "POST" ? json({ id: "b1" }, { status: 201 }) : stats(0)),
    );
    const onDone = renderForm();
    await userEvent.click(screen.getByRole("button", { name: "$3,000,000" }));
    await userEvent.click(screen.getByRole("button", { name: "Create budget" }));
    await waitFor(() => {
      expect(onDone).toHaveBeenCalled();
    });
    const body = JSON.parse(posts()[0]?.[1]?.body as string) as Record<string, unknown>;
    expect(body).toMatchObject({
      categoryIds: [],
      periodType: "MONTHLY",
      type: "EXPENSE",
      amount: 3_000_000,
      name: "Monthly budget",
    });
  });

  it("skips without calling the backend", async () => {
    const onDone = renderForm();
    await userEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(onDone).toHaveBeenCalled();
    expect(posts()).toHaveLength(0);
  });

  it("rejects an empty or zero amount", async () => {
    renderForm();
    await userEvent.clear(screen.getByRole("textbox", { name: "Monthly amount" }));
    await userEvent.click(screen.getByRole("button", { name: "Create budget" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Enter an amount greater than zero.",
    );
    expect(posts()).toHaveLength(0);
  });

  it("suggests amounts around last month's spending when there is history (F-01)", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(stats(1_284_300)));
    renderForm();
    expect(await screen.findByText("Based on last month’s spending")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "$1,000,000" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "$1,500,000" })).toBeInTheDocument();
  });
});
