// Every row's id is a uuid v7, so a path segment that is not one needs no request to be refused.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isEntityId(value: string | undefined): boolean {
  return value !== undefined && UUID.test(value);
}
