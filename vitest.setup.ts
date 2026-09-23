import "@testing-library/jest-dom/vitest";
// jsdom ships no IndexedDB; the offline vault and its migrations are tested against a real one.
import "fake-indexeddb/auto";

import { configure } from "@testing-library/dom";

// jsdom does not implement scrollIntoView; IconGrid uses it to reveal the selected icon.
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView(this: Element) {
    this.setAttribute("data-scrolled-into-view", "");
  };
}

// jsdom has no <dialog> methods yet; Sheet relies on showModal()/close().
if (typeof HTMLDialogElement !== "undefined" && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.show = function show() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close(returnValue?: string) {
    this.removeAttribute("open");
    if (returnValue !== undefined) this.returnValue = returnValue;
    this.dispatchEvent(new Event("close"));
  };
}

// jsdom implements no pointer capture; the bar that opens the full form (T-75) takes one.
if (typeof Element !== "undefined" && !Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = function setPointerCapture() {
    return undefined;
  };
  Element.prototype.releasePointerCapture = function releasePointerCapture() {
    return undefined;
  };
  Element.prototype.hasPointerCapture = function hasPointerCapture() {
    return false;
  };
}

// jsdom has no ResizeObserver and lays nothing out, so there is never a size to report.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {
      return undefined;
    }
    unobserve() {
      return undefined;
    }
    disconnect() {
      return undefined;
    }
  };
}

// F-87: jsdom has no matchMedia, and nothing is standalone unless a test says so.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  });
}

// F-73, like F-19's timeout: eight workers can make a render miss the default second.
configure({ asyncUtilTimeout: 5_000 });
