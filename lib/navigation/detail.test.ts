import { renderHook } from "@testing-library/react";

import { useDetailRouteId } from "./detail";

const pathname = vi.hoisted(() => ({ current: "/transactions/abc" }));
vi.mock("@/lib/i18n/navigation", () => ({ usePathname: () => pathname.current }));

describe("useDetailRouteId", () => {
  it("reads the id from the second segment of the route", () => {
    pathname.current = "/transactions/01920000-0000-7000-8000-000000000041";
    expect(renderHook(() => useDetailRouteId()).result.current).toBe(
      "01920000-0000-7000-8000-000000000041",
    );
    pathname.current = "/accounts/a1/edit";
    expect(renderHook(() => useDetailRouteId()).result.current).toBe("a1");
  });

  it("answers null where the route has no id", () => {
    pathname.current = "/transactions";
    expect(renderHook(() => useDetailRouteId()).result.current).toBeNull();
  });
});
