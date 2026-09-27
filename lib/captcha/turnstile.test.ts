import {
  HumanCheckError,
  loadTurnstile,
  resetTurnstileLoaderForTests,
  TURNSTILE_SCRIPT_URL,
  type TurnstileApi,
} from "./turnstile";

const scripts = () =>
  Array.from(document.head.querySelectorAll<HTMLScriptElement>("script")).filter(
    (script) => script.src === TURNSTILE_SCRIPT_URL,
  );

const fakeApi = {} as TurnstileApi;

beforeEach(() => {
  resetTurnstileLoaderForTests();
  delete window.turnstile;
  scripts().forEach((script) => {
    script.remove();
  });
});

describe("loadTurnstile", () => {
  it("adds Cloudflare's script once, in explicit mode, however many screens ask", async () => {
    const first = loadTurnstile();
    const second = loadTurnstile();
    expect(scripts()).toHaveLength(1);
    expect(TURNSTILE_SCRIPT_URL).toBe(
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",
    );
    window.turnstile = fakeApi;
    scripts()[0]?.dispatchEvent(new Event("load"));
    await expect(first).resolves.toBe(fakeApi);
    await expect(second).resolves.toBe(fakeApi);
  });

  it("fails loudly when the script is blocked, and tries again next time", async () => {
    const blocked = loadTurnstile();
    scripts()[0]?.dispatchEvent(new Event("error"));
    await expect(blocked).rejects.toBeInstanceOf(HumanCheckError);
    expect(scripts()).toHaveLength(0);

    void loadTurnstile().catch(() => undefined);
    expect(scripts()).toHaveLength(1);
  });
});
