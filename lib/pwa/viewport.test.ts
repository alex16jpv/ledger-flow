import { beforeEach, describe, expect, it, vi } from "vitest";

import { INSTALLED_VIEWPORT_SUFFIX, VIEWPORT_INIT_SCRIPT } from "./viewport-script";

const SERVED = "width=device-width, initial-scale=1, viewport-fit=cover";
const FIXED = SERVED + INSTALLED_VIEWPORT_SUFFIX;

function runHeadScript(): void {
  new Function(VIEWPORT_INIT_SCRIPT)();
}

function viewportContent(): string | null {
  return document.querySelector("meta[name=viewport]")?.getAttribute("content") ?? null;
}

function addMeta(content = SERVED): void {
  const tag = document.createElement("meta");
  tag.setAttribute("name", "viewport");
  tag.setAttribute("content", content);
  document.head.append(tag);
}

function standalone(matches: boolean): { becomes: (next: boolean) => void } {
  const listeners: (() => void)[] = [];
  const query = {
    matches,
    addEventListener: (_: string, apply: () => void) => void listeners.push(apply),
    removeEventListener: vi.fn(),
  };
  window.matchMedia = vi.fn().mockReturnValue(query);
  return {
    becomes: (next) => {
      query.matches = next;
      for (const apply of listeners) apply();
    },
  };
}

describe("viewport head script", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    delete (navigator as Navigator & { standalone?: boolean }).standalone;
  });

  it("fixes the scale in the installed app", () => {
    standalone(true);
    addMeta();

    runHeadScript();

    expect(viewportContent()).toBe(FIXED);
  });

  // Blocking zoom in a browser tab fails WCAG 1.4.4, and the tab is what axe scans in every e2e.
  it("leaves the document scalable in a browser", () => {
    standalone(false);
    addMeta();

    runHeadScript();

    expect(viewportContent()).toBe(SERVED);
  });

  it("reads iOS's own answer, which has no display-mode media query", () => {
    standalone(false);
    (navigator as Navigator & { standalone?: boolean }).standalone = true;
    addMeta();

    runHeadScript();

    expect(viewportContent()).toBe(FIXED);
  });

  // Next decides where the viewport meta lands in the head, so the tag can run before it exists.
  it("applies once the document is parsed when the meta is not there yet", () => {
    standalone(true);

    runHeadScript();
    addMeta();
    document.dispatchEvent(new Event("DOMContentLoaded"));

    expect(viewportContent()).toBe(FIXED);
  });

  it("gives the zoom back when the app stops being the installed one", () => {
    const display = standalone(true);
    addMeta();
    runHeadScript();
    expect(viewportContent()).toBe(FIXED);

    display.becomes(false);

    expect(viewportContent()).toBe(SERVED);
  });

  it("does not add the suffix twice", () => {
    standalone(true);
    addMeta();

    runHeadScript();
    runHeadScript();

    expect(viewportContent()).toBe(FIXED);
  });

  it("survives a document with no viewport meta at all", () => {
    standalone(true);

    expect(() => {
      runHeadScript();
      document.dispatchEvent(new Event("DOMContentLoaded"));
    }).not.toThrow();
  });
});
