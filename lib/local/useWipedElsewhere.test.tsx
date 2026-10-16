import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";

import { tabChannel } from "@/lib/session/channel";

import { useWipedElsewhere } from "./useWipedElsewhere";
import { loadSignInAfterWipe } from "./wipe";

vi.mock("next-intl", () => ({ useLocale: () => "es" }));
vi.mock("./wipe", () => ({ loadSignInAfterWipe: vi.fn() }));

const client = new QueryClient();
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

afterEach(() => {
  tabChannel.reset();
  vi.mocked(loadSignInAfterWipe).mockClear();
});

// T-166: a tab that stayed would open the copy again and download everything into it.
describe("useWipedElsewhere", () => {
  it("forgets what it holds and loads sign-in when another tab deleted everything", () => {
    const clear = vi.spyOn(client, "clear");
    renderHook(useWipedElsewhere, { wrapper });

    tabChannel.emitLocal({ type: "device:wiped" });

    expect(clear).toHaveBeenCalledOnce();
    expect(loadSignInAfterWipe).toHaveBeenCalledWith("es");
  });

  it("ignores every other message on the channel", () => {
    renderHook(useWipedElsewhere, { wrapper });

    tabChannel.emitLocal({ type: "session:logout" });

    expect(loadSignInAfterWipe).not.toHaveBeenCalled();
  });
});
