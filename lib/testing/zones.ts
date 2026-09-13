export function inDeviceZone<T>(zone: string, run: () => T): T {
  const before = process.env.TZ;
  process.env.TZ = zone;
  try {
    return run();
  } finally {
    if (before === undefined) delete process.env.TZ;
    else process.env.TZ = before;
  }
}
