vi.mock("server-only", () => ({}));

import { formatRequestLog } from "./log";

describe("formatRequestLog", () => {
  it("emits one JSON line with the requestId and no request data", () => {
    const line = formatRequestLog(
      { requestId: "req-1", method: "GET", path: "transactions", status: 200, durationMs: 12 },
      new Date("2026-09-02T10:00:00Z"),
    );
    expect(JSON.parse(line)).toEqual({
      level: "info",
      msg: "request",
      at: "2026-09-02T10:00:00.000Z",
      requestId: "req-1",
      method: "GET",
      path: "transactions",
      status: 200,
      durationMs: 12,
    });
  });

  it("marks upstream failures as errors", () => {
    const line = formatRequestLog({
      requestId: null,
      method: "POST",
      path: "x",
      status: 503,
      durationMs: 1,
    });
    expect((JSON.parse(line) as { level: string }).level).toBe("error");
  });
});
