import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { STORAGE_KEYS } from "./palettes";
import { themeStore } from "./store";
import { ThemeProvider, useTheme } from "./ThemeProvider";

function Probe() {
  const { palette, mode, resolvedMode, setPalette, setMode } = useTheme();
  return (
    <div>
      <output data-testid="state">{`${palette}/${mode}/${resolvedMode}`}</output>
      <button
        onClick={() => {
          setPalette("tinta");
        }}
      >
        tinta
      </button>
      <button
        onClick={() => {
          setMode("dark");
        }}
      >
        dark
      </button>
    </div>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  themeStore.reset();
  document.documentElement.removeAttribute("data-palette");
  document.documentElement.removeAttribute("data-mode");
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
});

describe("ThemeProvider", () => {
  it("applies the stored theme on mount", () => {
    window.localStorage.setItem(STORAGE_KEYS.palette, "tinta");
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("state")).toHaveTextContent("tinta/system/light");
    expect(document.documentElement.dataset.palette).toBe("tinta");
  });

  it("changes palette and mode without a reload and persists them", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    await user.click(screen.getByRole("button", { name: "tinta" }));
    await user.click(screen.getByRole("button", { name: "dark" }));
    expect(screen.getByTestId("state")).toHaveTextContent("tinta/dark/dark");
    expect(document.documentElement.dataset.palette).toBe("tinta");
    expect(document.documentElement.dataset.mode).toBe("dark");
    expect(window.localStorage.getItem(STORAGE_KEYS.palette)).toBe("tinta");
    expect(window.localStorage.getItem(STORAGE_KEYS.mode)).toBe("dark");
  });

  it("does not notify listeners when the theme is unchanged", () => {
    const listener = vi.fn();
    themeStore.subscribe(listener);
    themeStore.set({ ...themeStore.getSnapshot() });
    expect(listener).not.toHaveBeenCalled();
    themeStore.set({ palette: "tinta", mode: "dark" });
    expect(listener).toHaveBeenCalledOnce();
  });

  it("follows external store updates (other tabs)", () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    act(() => {
      themeStore.set({ palette: "tinta", mode: "light" }, { persist: false });
    });
    expect(screen.getByTestId("state")).toHaveTextContent("tinta/light/light");
    expect(window.localStorage.getItem(STORAGE_KEYS.palette)).toBeNull();
  });
});
