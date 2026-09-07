import { v7 as uuidv7 } from "uuid";

export const REQUEST_ID_HEADER = "x-request-id";

export function newRequestId(): string {
  return uuidv7();
}
