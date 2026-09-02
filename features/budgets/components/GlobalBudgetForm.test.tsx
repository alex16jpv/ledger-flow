import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { QueryProvider } from "@/lib/query/QueryProvider";
import { renderWithProviders } from "@/lib/testing/render";

import { GlobalBudgetForm } from "./GlobalBudgetForm";

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, ...init });
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
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
    fetchMock.mockResolvedValue(json({ id: "b1" }, { status: 201 }));
    const onDone = renderForm();
    await userEvent.click(screen.getByRole("button", { name: "$3,000,000" }));
    await userEvent.click(screen.getByRole("button", { name: "Create budget" }));
    await waitFor(() => {
      expect(onDone).toHaveBeenCalled();
    });
    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as Record<
      string,
      unknown
    >;
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
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an empty or zero amount", async () => {
    renderForm();
    await userEvent.clear(screen.getByRole("textbox", { name: "Monthly amount" }));
    await userEvent.click(screen.getByRole("button", { name: "Create budget" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Enter an amount greater than zero.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
