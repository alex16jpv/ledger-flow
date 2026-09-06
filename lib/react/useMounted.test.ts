import { renderHook } from "@testing-library/react";
import { createElement } from "react";
import { renderToString } from "react-dom/server";

import { useMounted } from "./useMounted";

describe("useMounted", () => {
  it("is false on the server and true once rendered on the client", () => {
    function Probe() {
      return createElement("span", null, String(useMounted()));
    }
    expect(renderToString(createElement(Probe))).toContain("false");
    expect(renderHook(() => useMounted()).result.current).toBe(true);
  });
});
