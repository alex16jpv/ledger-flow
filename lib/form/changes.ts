// Only what the user touched travels in an edit. The sync queue classifies a conflict by the fields
// the operation carries (§6 O-F5a of the offline plan), so a body that names every field turns every
// disagreement between two devices into a question the user should never have been asked: a rename
// on one device and a colour on the other are compatible, and they combine (§1 example 3).
//
// React Hook Form marks a field dirty only while its value differs from the one the form opened
// with, so a value typed and typed back does not travel. `dirtyFields` must be read during render:
// `formState` is a Proxy that tracks what the component subscribed to.
// An untouched edit sends nothing: every `PUT` of the API refuses an empty body ("At least one field
// must be provided"), and offline that refusal would land in the attention tray for having changed
// nothing.
export function nothingChanged(changes: object): boolean {
  return Object.keys(changes).length === 0;
}

export function changedOnly<T extends object>(
  values: T,
  dirty: Partial<Record<keyof T, unknown>>,
): Partial<T> {
  return Object.fromEntries(
    Object.entries(values).filter(([key]) => dirty[key as keyof T]),
  ) as Partial<T>;
}
