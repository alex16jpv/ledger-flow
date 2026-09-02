import { transactionKeys } from "./keys";
import { draftToSearchParams, quickAddSchema } from "./schemas";

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

describe("transactions", () => {
  it("nests keys under the feature root", () => {
    expect(transactionKeys.pendingCount()).toEqual(["transactions", "pending-count"]);
  });

  it("validates the quick sheet with message keys", () => {
    expect(
      quickAddSchema.safeParse({ amount: 0, categoryId: null, accountId: null, description: "" })
        .error?.issues[0]?.message,
    ).toBe("validation.amountPositive");
    expect(
      quickAddSchema.safeParse({ amount: NaN, categoryId: null, accountId: null, description: "" })
        .error?.issues[0]?.message,
    ).toBe("validation.amountInvalid");
    expect(
      quickAddSchema.safeParse({
        amount: 10_000_000_000_001,
        categoryId: null,
        accountId: null,
        description: "",
      }).error?.issues[0]?.message,
    ).toBe("validation.amountMax");
    expect(
      quickAddSchema.safeParse({
        amount: 12500,
        categoryId: "c1",
        accountId: "a1",
        description: " x ",
      }).data?.description,
    ).toBe("x");
  });

  it("carries only the filled draft fields to the full form", () => {
    expect(
      draftToSearchParams({
        amount: 12500,
        categoryId: null,
        accountId: "a1",
        description: "  ",
      }).toString(),
    ).toBe("amount=12500&accountId=a1");
    expect(
      draftToSearchParams({
        amount: null,
        categoryId: "c1",
        accountId: null,
        description: "Uber",
      }).toString(),
    ).toBe("categoryId=c1&description=Uber");
  });

  it("adds the note with a PUT and clears pendingDetails only when a category came along", async () => {
    const { quickAddWithDetails } = await import("./hooks");
    fetchMock
      .mockResolvedValueOnce(json({ id: "t1", pendingDetails: true }, { status: 201 }))
      .mockResolvedValueOnce(json({ id: "t1", pendingDetails: false, description: "Uber" }));
    const result = await quickAddWithDetails({
      input: { amount: 12500, categoryId: "c1", fromAccountId: "a1" },
      description: "Uber",
      idempotencyKey: "key-1",
    });
    expect(result).toEqual({
      transaction: expect.objectContaining({ description: "Uber" }),
      detailsSaved: true,
    });
    const [quick, put] = fetchMock.mock.calls;
    expect(quick?.[0]).toContain("/api/transactions/quick");
    expect(new Headers(quick?.[1]?.headers).get("Idempotency-Key")).toBe("key-1");
    expect(put?.[1]?.method).toBe("PUT");
    expect(JSON.parse(put?.[1]?.body as string)).toEqual({
      description: "Uber",
      pendingDetails: false,
    });
  });

  it("clears pendingDetails with a category alone and leaves it when only a note came", async () => {
    const { quickAddWithDetails } = await import("./hooks");
    fetchMock
      .mockResolvedValueOnce(json({ id: "t4", pendingDetails: true }, { status: 201 }))
      .mockResolvedValueOnce(json({ id: "t4", pendingDetails: false }));
    await quickAddWithDetails({
      input: { amount: 100, categoryId: "c1" },
      description: null,
      idempotencyKey: "k4",
    });
    expect(JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string)).toEqual({
      pendingDetails: false,
    });

    fetchMock
      .mockResolvedValueOnce(json({ id: "t5", pendingDetails: true }, { status: 201 }))
      .mockResolvedValueOnce(json({ id: "t5", pendingDetails: true, description: "x" }));
    await quickAddWithDetails({ input: { amount: 100 }, description: "x", idempotencyKey: "k5" });
    expect(JSON.parse(fetchMock.mock.calls[3]?.[1]?.body as string)).toEqual({ description: "x" });
  });

  it("keeps the transaction and reports the failed note instead of throwing", async () => {
    const { quickAddWithDetails } = await import("./hooks");
    fetchMock
      .mockResolvedValueOnce(json({ id: "t2", pendingDetails: true }, { status: 201 }))
      .mockResolvedValueOnce(json({ code: "INTERNAL", message: "boom" }, { status: 500 }));
    const result = await quickAddWithDetails({
      input: { amount: 100 },
      description: "late",
      idempotencyKey: "key-2",
    });
    expect(result).toEqual({
      transaction: expect.objectContaining({ id: "t2" }),
      detailsSaved: false,
    });
  });

  it("skips the PUT when there is no note", async () => {
    const { quickAddWithDetails } = await import("./hooks");
    fetchMock.mockResolvedValueOnce(json({ id: "t3" }, { status: 201 }));
    await quickAddWithDetails({ input: { amount: 100 }, description: null, idempotencyKey: "k" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
