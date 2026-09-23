const PHONE = "(max-width: 599.98px)";

export function withPhoneWidth(): void {
  let before: typeof window.matchMedia;
  beforeEach(() => {
    before = window.matchMedia.bind(window);
    window.matchMedia = (query: string) => ({
      matches: query === PHONE,
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
