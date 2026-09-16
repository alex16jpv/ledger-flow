const NO_HOVER = "(hover: none)";

export function withTouchPointer(): void {
  let before: typeof window.matchMedia;
  beforeEach(() => {
    before = window.matchMedia.bind(window);
    window.matchMedia = (query: string) => ({
      matches: query === NO_HOVER,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    });
  });
  afterEach(() => {
    window.matchMedia = before;
  });
}
