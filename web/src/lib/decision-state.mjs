/** Product-level decision guidance. Canonical tracker status remains untouched. */
export function decisionBand(score, scoreOf) {
  const n = scoreOf(score ?? "");
  if (Number.isNaN(n)) return { key: "unscored", label: "Needs scoring", actionable: false };
  if (n >= 4) return { key: "recommended", label: "Recommended", actionable: true };
  if (n >= 3.5) return { key: "hold", label: "Hold", actionable: false };
  return { key: "reject", label: "Reject", actionable: false };
}
