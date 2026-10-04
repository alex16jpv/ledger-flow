interface PolicyVersion {
  version: number;
  effective: string;
}

export const CURRENT_POLICY: PolicyVersion = { version: 2, effective: "2026-10-04" };

export const TERMS_UPDATED = "2026-10-04";

const POLICY_VERSIONS: readonly PolicyVersion[] = [
  { version: 1, effective: "2026-09-01" },
  CURRENT_POLICY,
];

const startOf = (day: string) => Date.parse(`${day}T00:00:00-05:00`);

export function acceptedPolicyVersion(signedUpAt: Date): number {
  const accepted = POLICY_VERSIONS.findLast(
    ({ effective }) => startOf(effective) <= signedUpAt.getTime(),
  );
  return accepted?.version ?? 1;
}
