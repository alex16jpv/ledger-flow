import { tabChannel } from "./channel";

describe("tabChannel", () => {
  afterEach(() => {
    tabChannel.reset();
  });

  it("delivers local emissions to subscribers and stops after unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = tabChannel.subscribe(listener);
    tabChannel.emitLocal({ type: "session:expired" });
    expect(listener).toHaveBeenCalledWith({ type: "session:expired" });
    unsubscribe();
    tabChannel.emitLocal({ type: "session:logout" });
    expect(listener).toHaveBeenCalledOnce();
  });

  it("does not throw without BroadcastChannel support", () => {
    const original = globalThis.BroadcastChannel;
    vi.stubGlobal("BroadcastChannel", undefined);
    expect(() => {
      tabChannel.post({ type: "session:logout" });
    }).not.toThrow();
    vi.stubGlobal("BroadcastChannel", original);
  });
});
