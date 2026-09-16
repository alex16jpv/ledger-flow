import { act, renderHook } from "@testing-library/react";
import type { MouseEvent } from "react";

import { withTouchPointer } from "@/lib/testing/pointer";

import { useCanHover, useSlotOpen } from "./slotOpen";

const before = window.matchMedia.bind(window);

function tap(detail: number) {
  return { detail } as MouseEvent<HTMLElement>;
}

afterEach(() => {
  window.matchMedia = before;
});

describe("useCanHover", () => {
  it("keeps the pointer's behaviour where nothing declares one", () => {
    Reflect.deleteProperty(window, "matchMedia");
    const { result } = renderHook(() => useCanHover());
    expect(result.current).toBe(true);
  });

  it("follows a pointer that changes while the page is open", () => {
    const query = new EventTarget();
    let touch = false;
    window.matchMedia = (media: string) =>
      Object.assign(query, {
        matches: media === "(hover: none)" && touch,
        media,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
      });
    const { result } = renderHook(() => useCanHover());
    expect(result.current).toBe(true);
    act(() => {
      touch = true;
      query.dispatchEvent(new Event("change"));
    });
    expect(result.current).toBe(false);
  });
});

describe("useSlotOpen", () => {
  it("is nothing to call where the slots lead nowhere", () => {
    const { result } = renderHook(() => useSlotOpen(undefined));
    expect(result.current).toBeUndefined();
  });

  it("opens on every activation where the pointer hovers", () => {
    const onSelect = vi.fn();
    const { result } = renderHook(() => useSlotOpen(onSelect));
    result.current?.(2)(tap(1));
    result.current?.(2)(tap(0));
    expect(onSelect.mock.calls).toEqual([[2], [2]]);
  });

  describe("where the pointer cannot hover", () => {
    withTouchPointer();

    it("opens from a key but not from a tap, so no slot is left dead", () => {
      const onSelect = vi.fn();
      const { result } = renderHook(() => useSlotOpen(onSelect));
      result.current?.(2)(tap(1));
      expect(onSelect).not.toHaveBeenCalled();
      result.current?.(2)(tap(0));
      expect(onSelect).toHaveBeenCalledWith(2);
    });
  });
});
