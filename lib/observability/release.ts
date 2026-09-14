// H-60: the build and the runtime must name the release the same, or each deploy becomes two records.
export function releaseName(): string {
  const candidates = [
    process.env.NEXT_PUBLIC_APP_VERSION,
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
    process.env.VERCEL_GIT_COMMIT_SHA,
  ];
  return candidates.find((value) => value !== undefined && value !== "") ?? "dev";
}

export function shortRelease(name: string): string {
  return /^[0-9a-f]{40}$/.test(name) ? name.slice(0, 7) : name;
}
