import type { OverviewItem } from "./overview";
import { decideNotification } from "./thresholds";

export interface PlannedNotification {
  versionId: number;
  className: string;
  expiryDate: string;
  daysLeft: number;
  /** All thresholds to log for this version, including the one notified about. */
  markSent: number[];
}

/**
 * What to send now: at most one notification per class, about its current version only.
 * Superseded versions never notify. `sent` holds the thresholds already logged per version id.
 */
export function planNotifications(
  items: OverviewItem[],
  thresholds: number[],
  sent: Map<number, number[]>,
): PlannedNotification[] {
  const planned: PlannedNotification[] = [];
  for (const { documentClass, current, daysLeft } of items) {
    if (daysLeft === null || current.expiry_date === null) continue;
    const { notify, markSent } = decideNotification(daysLeft, thresholds, sent.get(current.id) ?? []);
    if (notify === null) continue;
    planned.push({ versionId: current.id, className: documentClass.name, expiryDate: current.expiry_date, daysLeft, markSent });
  }
  return planned;
}

export function groupSentByVersion(rows: { version_id: number; threshold_days: number }[]): Map<number, number[]> {
  const map = new Map<number, number[]>();
  for (const r of rows) map.set(r.version_id, [...(map.get(r.version_id) ?? []), r.threshold_days]);
  return map;
}
