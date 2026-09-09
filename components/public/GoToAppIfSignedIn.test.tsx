import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GoToAppIfSignedIn } from "./GoToAppIfSignedIn";

const replace = vi.fn();

function withCookie(value: string): void {
  Object.defineProperty(document, "cookie", { value, configurable: true, writable: true });
}

describe("GoToAppIfSignedIn", () => {
  afterEach(() => {
    replace.mockReset();
    withCookie("");
  });

  it("sends a device that holds a vault to the app", () => {
    withCookie(`__Host-session=01920000-0000-7000-8000-000000000001.${Date.now() / 1000}`);
    vi.stubGlobal("location", { origin: "https://app.test", replace });

    render(<GoToAppIfSignedIn />);

    expect(replace).toHaveBeenCalledWith("https://app.test/home");
  });

  it("leaves a visitor with no marker on the landing", () => {
    withCookie("lf.locale=en");
    vi.stubGlobal("location", { origin: "https://app.test", replace });

    render(<GoToAppIfSignedIn />);

    expect(replace).not.toHaveBeenCalled();
  });
});
