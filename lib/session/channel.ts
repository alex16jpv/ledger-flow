export const CHANNEL_NAME = "lf";

export type TabMessage =
  | { type: "session:expired" }
  | { type: "session:logout" }
  | { type: "session:refreshed"; at: number }
  | { type: "theme"; palette: string; mode: string }
  | { type: "locale"; locale: string };

type Listener = (message: TabMessage) => void;

const listeners = new Set<Listener>();
let channel: BroadcastChannel | null = null;

function ensureChannel(): BroadcastChannel | null {
  if (channel) return channel;
  if (typeof BroadcastChannel === "undefined") return null;
  channel = new BroadcastChannel(CHANNEL_NAME);
  channel.addEventListener("message", (event: MessageEvent<TabMessage>) => {
    for (const listener of listeners) listener(event.data);
  });
  return channel;
}

export const tabChannel = {
  post(message: TabMessage): void {
    ensureChannel()?.postMessage(message);
  },
  subscribe(listener: Listener): () => void {
    ensureChannel();
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  emitLocal(message: TabMessage): void {
    for (const listener of listeners) listener(message);
  },
  reset(): void {
    channel?.close();
    channel = null;
    listeners.clear();
  },
};
