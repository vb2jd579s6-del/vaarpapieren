/** Default reminder thresholds in days before expiry; 0 is the expiry day itself. */
export const DEFAULT_THRESHOLDS = [90, 60, 30, 14, 7, 1, 0];

export function normalizeThresholds(values: number[]): number[] {
  const valid = values.filter((v) => Number.isInteger(v) && v >= 0);
  return [...new Set(valid)].sort((a, b) => b - a);
}

/** The thresholds that have been reached: `daysLeft` is at or below the threshold. */
export function reachedThresholds(daysLeft: number, thresholds: number[]): number[] {
  if (daysLeft < 0) return [];
  return normalizeThresholds(thresholds).filter((t) => daysLeft <= t);
}

export interface NotificationDecision {
  /** Threshold to notify about now, or null when there is nothing to send. */
  notify: number | null;
  /** All reached thresholds not yet logged; log these so they are never sent later. */
  markSent: number[];
}

/**
 * Decide what to send for one version. Only the tightest reached threshold results in a
 * notification, so a document added 5 days before expiry gives one message instead of
 * one per skipped threshold. Every reached threshold is still logged, so each fires at most once.
 */
export function decideNotification(
  daysLeft: number | null,
  thresholds: number[],
  alreadySent: number[],
): NotificationDecision {
  if (daysLeft === null) return { notify: null, markSent: [] };
  const sent = new Set(alreadySent);
  const pending = reachedThresholds(daysLeft, thresholds).filter((t) => !sent.has(t));
  if (pending.length === 0) return { notify: null, markSent: [] };
  return { notify: Math.min(...pending), markSent: pending };
}
