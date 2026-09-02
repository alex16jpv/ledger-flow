import en from "@/messages/en.json";

import {
  ApiError,
  ERROR_CODES,
  ERROR_TABLE,
  fieldErrors,
  NetworkError,
  presentError,
} from "./errors";

describe("ERROR_TABLE", () => {
  it("has a presentation and an English message for every code", () => {
    for (const code of ERROR_CODES) {
      const presentation = ERROR_TABLE[code];
      const key = presentation.messageKey.replace(/^errors\./, "");
      expect(en.errors, code).toHaveProperty(key);
      if (presentation.scope === "field") expect(presentation.field, code).toBeTruthy();
    }
  });
});

describe("presentError", () => {
  it("branches on code, never on message", () => {
    const error = new ApiError({
      status: 400,
      code: "FUTURE_DATE",
      message: "whatever",
      requestId: "r1",
    });
    expect(presentError(error)).toEqual({
      scope: "field",
      field: "date",
      messageKey: "errors.FUTURE_DATE",
    });
  });

  it("falls back to the status when the code is unknown", () => {
    expect(
      presentError(new ApiError({ status: 503, code: null, message: "x", requestId: "r" })).scope,
    ).toBe("screen");
    expect(
      presentError(new ApiError({ status: 429, code: null, message: "x", requestId: "r" })).scope,
    ).toBe("rateLimit");
    expect(
      presentError(new ApiError({ status: 418, code: null, message: "x", requestId: "r" }))
        .messageKey,
    ).toBe("errors.INTERNAL");
  });

  it("distinguishes timeouts from other network failures", () => {
    expect(presentError(new NetworkError("r", true)).messageKey).toBe("errors.TIMEOUT");
    expect(presentError(new NetworkError("r", false)).messageKey).toBe("errors.NETWORK");
    expect(presentError(new Error("boom")).messageKey).toBe("errors.UNKNOWN");
  });
});

describe("fieldErrors", () => {
  it("maps validation details to fields, first message wins", () => {
    const error = new ApiError({
      status: 400,
      code: "VALIDATION",
      message: "Validation failed",
      requestId: "r",
      details: [
        { field: "email", message: "Invalid email" },
        { field: "email", message: "Too long" },
        { field: "password", message: "Too short" },
      ],
    });
    expect(fieldErrors(error)).toEqual({ email: "Invalid email", password: "Too short" });
    expect(fieldErrors(new Error("x"))).toEqual({});
  });
});
