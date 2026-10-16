interface HeldLock {
  name: string;
  mode: LockMode;
}

// jsdom has no Web Locks; this one honours shared and exclusive modes and `signal`, and lists what is held.
export function installFakeLocks(): () => void {
  const held: HeldLock[] = [];
  const waiting = new Set<() => void>();
  const conflicts = (name: string, mode: LockMode): boolean =>
    held.some((lock) => lock.name === name && (mode === "exclusive" || lock.mode === "exclusive"));
  const released = (): void => {
    for (const wake of [...waiting]) wake();
  };
  const locks = {
    request: async <T>(
      name: string,
      options: LockOptions,
      callback: (lock: Lock | null) => Promise<T> | T,
    ): Promise<T> => {
      const mode = options.mode ?? "exclusive";
      const { signal } = options;
      if (signal?.aborted) throw signal.reason as Error;
      while (conflicts(name, mode)) {
        await new Promise<void>((resolve, reject) => {
          const wake = (): void => {
            waiting.delete(wake);
            resolve();
          };
          waiting.add(wake);
          signal?.addEventListener("abort", () => {
            waiting.delete(wake);
            reject(signal.reason as Error);
          });
          if (signal?.aborted) reject(signal.reason as Error);
        });
      }
      const lock: HeldLock = { name, mode };
      held.push(lock);
      try {
        return await callback(lock);
      } finally {
        held.splice(held.indexOf(lock), 1);
        released();
      }
    },
    query: (): Promise<LockManagerSnapshot> => Promise.resolve({ held: [...held], pending: [] }),
  };
  Object.defineProperty(navigator, "locks", { value: locks, configurable: true });
  return () => {
    Reflect.deleteProperty(navigator, "locks");
  };
}
