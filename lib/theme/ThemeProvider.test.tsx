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
          setPalette("brisa");
        }}
      >
        brisa
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
    window.localStorage.setItem(STORAGE_KEYS.palette, "brisa");
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("state")).toHaveTextContent("brisa/system/light");
    expect(document.documentElement.dataset.palette).toBe("brisa");
  });

  it("changes palette and mode without a reload and persists them", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    await user.click(screen.getByRole("button", { name: "brisa" }));
    await user.click(screen.getByRole("button", { name: "dark" }));
    expect(screen.getByTestId("state")).toHaveTextContent("brisa/dark/dark");
    expect(document.documentElement.dataset.palette).toBe("brisa");
    expect(document.documentElement.dataset.mode).toBe("dark");
    expect(window.localStorage.getItem(STORAGE_KEYS.palette)).toBe("brisa");
    expect(window.localStorage.getItem(STORAGE_KEYS.mode)).toBe("dark");
  });

  it("follows external store updates (other tabs)", () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    act(() => {
      themeStore.set({ palette: "brisa", mode: "light" }, { persist: false });
    });
    expect(screen.getByTestId("state")).toHaveTextContent("brisa/light/light");
    expect(window.localStorage.getItem(STORAGE_KEYS.palette)).toBeNull();
  });
});
