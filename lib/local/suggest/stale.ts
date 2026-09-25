type Listener = () => void;

const listeners = new Set<Listener>();
let version = 0;

export function markSuggestionsStale(): void {
  version += 1;
  for (const listener of listeners) listener();
}

export function suggestionsVersion(): number {
  return version;
}

export function onSuggestionsStale(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
