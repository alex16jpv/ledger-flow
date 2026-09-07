import type en from "@/messages/en.json";

export type ValidationKey = `validation.${keyof typeof en.validation}`;

const PREFIX = "validation.";

export function isValidationKey(value: unknown): value is ValidationKey {
  return typeof value === "string" && value.startsWith(PREFIX);
}

// A server detail that is not one of our keys is never shown raw (HANDOFF §3.8): it becomes the generic message.
export function validationMessage(
  translate: (key: ValidationKey) => string,
  message: string | undefined,
): string | undefined {
  if (!message) return undefined;
  return translate(isValidationKey(message) ? message : "validation.invalid");
}
