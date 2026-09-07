import { ApiError, NetworkError } from "@/lib/api/errors";

import { isReportable, reportError, requestIdOf, setErrorReporter } from "./reporter";

const apiError = (status: number) =>
  new ApiError({ status, code: null, message: "boom", requestId: "req-42" });

afterEach(() => {
  setErrorReporter(null);
});

describe("requestIdOf", () => {
  it("reads the id from api and network errors only", () => {
    expect(requestIdOf(apiError(500))).toBe("req-42");
    expect(requestIdOf(new NetworkError("req-7", true))).toBe("req-7");
    expect(requestIdOf(new Error("x"))).toBeNull();
  });
});

describe("isReportable", () => {
  it("reports server failures and unknown errors, not client-side outcomes", () => {
    expect(isReportable(apiError(500))).toBe(true);
    expect(isReportable(apiError(404))).toBe(false);
    expect(isReportable(new Error("render"))).toBe(true);
  });

  it("skips network errors while the browser knows it is offline", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    expect(isReportable(new NetworkError("req-1", false))).toBe(false);
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    expect(isReportable(new NetworkError("req-1", false))).toBe(true);
  });
});

describe("reportError", () => {
  it("is a no-op without a reporter and forwards scope and requestId with one", () => {
    expect(() => {
      reportError(new Error("x"), "boundary");
    }).not.toThrow();
    const reporter = vi.fn();
    setErrorReporter(reporter);
    const error = apiError(503);
    reportError(error, "api");
    expect(reporter).toHaveBeenCalledWith(error, { scope: "api", requestId: "req-42" });
  });
});
