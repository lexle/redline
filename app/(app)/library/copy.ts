/** Words the library screens share. */

export function riskFlagCountCopy(count: number): string {
  if (count === 0) return "No risk flags";
  return `${count} risk ${count === 1 ? "flag" : "flags"}`;
}

/** The day a Document was saved, e.g. "Sep 14, 2026". A fixed locale, so every render agrees. */
export function formatSavedDate(createdAt: string): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(createdAt));
}
