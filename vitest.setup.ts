import "@testing-library/jest-dom/vitest";
// jsdom ships no IndexedDB; the offline vault and its migrations are tested against a real one.
import "fake-indexeddb/auto";

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
