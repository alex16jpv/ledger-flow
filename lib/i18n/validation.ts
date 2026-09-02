import type en from "@/messages/en.json";

export type ValidationKey = `validation.${keyof typeof en.validation}`;

const PREFIX = "validation.";

export function isValidationKey(value: unknown): value is ValidationKey {
  return typeof value === "string" && value.startsWith(PREFIX);
}

export function validationMessage(
  translate: (key: ValidationKey) => string,
  message: string | undefined,
): string | undefined {
  if (!message) return undefined;
  return isValidationKey(message) ? translate(message) : message;
}
