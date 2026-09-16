import { transactionKeys } from "./keys";
import { draftToSearchParams, type QuickAddDraft, quickAddInput, quickAddSchema } from "./schemas";

const draft = (over: Partial<QuickAddDraft> = {}): QuickAddDraft => ({
  type: "EXPENSE",
  amount: 12500,
  categoryId: null,
  accountId: null,
  toAccountId: null,
  description: "",
  ...over,
});

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
    expect(quickAddSchema.safeParse(draft({ amount: 0 })).error?.issues[0]?.message).toBe(
      "validation.amountPositive",
    );
    expect(quickAddSchema.safeParse(draft({ amount: NaN })).error?.issues[0]?.message).toBe(
      "validation.amountInvalid",
    );
    expect(
      quickAddSchema.safeParse(draft({ amount: 10_000_000_000_001 })).error?.issues[0]?.message,
    ).toBe("validation.amountMax");
    expect(
      quickAddSchema.safeParse(draft({ categoryId: "c1", accountId: "a1", description: " x " }))
        .data?.description,
    ).toBe("x");
  });

  // T-73: the sheet records all three types, and a transfer is the one with two sides to check.
  it("refuses a transfer with one side missing or both the same", () => {
    const missing = quickAddSchema.safeParse(draft({ type: "TRANSFER", accountId: "a1" }));
    expect(missing.error?.issues[0]?.message).toBe("validation.required");
    expect(missing.error?.issues[0]?.path).toEqual(["toAccountId"]);

    const same = quickAddSchema.safeParse(
      draft({ type: "TRANSFER", accountId: "a1", toAccountId: "a1" }),
    );
    expect(same.error?.issues[0]?.message).toBe("validation.sameAccount");

    expect(
      quickAddSchema.safeParse(draft({ type: "TRANSFER", accountId: "a1", toAccountId: "a2" }))
        .success,
    ).toBe(true);
  });

  it("puts the one account on the side its type spends from", () => {
    const parse = (over: Partial<QuickAddDraft>) => {
      const result = quickAddSchema.safeParse(draft(over));
      if (!result.success) throw result.error;
      return quickAddInput(result.data);
    };
    expect(parse({ accountId: "a1" })).toEqual({
      amount: 12500,
      type: "EXPENSE",
      fromAccountId: "a1",
    });
    expect(parse({ type: "INCOME", accountId: "a1" })).toEqual({
      amount: 12500,
      type: "INCOME",
      toAccountId: "a1",
    });
    expect(parse({ type: "TRANSFER", accountId: "a1", toAccountId: "a2" })).toEqual({
      amount: 12500,
      type: "TRANSFER",
      fromAccountId: "a1",
      toAccountId: "a2",
    });
  });

  it("carries only the filled draft fields to the full form", () => {
    expect(draftToSearchParams(draft({ accountId: "a1", description: "  " })).toString()).toBe(
      "type=EXPENSE&amount=12500&accountId=a1",
    );
    expect(
      draftToSearchParams(
        draft({ amount: null, categoryId: "c1", description: "Uber" }),
      ).toString(),
    ).toBe("type=EXPENSE&categoryId=c1&description=Uber");
    expect(
      draftToSearchParams(
        draft({ type: "TRANSFER", accountId: "a1", toAccountId: "a2" }),
      ).toString(),
    ).toBe("type=TRANSFER&amount=12500&accountId=a1&toAccountId=a2");
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
    // The key is the row's id now, in the body: a create carrying an id is already idempotent.
    expect(JSON.parse(quick?.[1]?.body as string)).toMatchObject({ id: "key-1" });
    expect(new Headers(quick?.[1]?.headers).get("Idempotency-Key")).toBeNull();
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
