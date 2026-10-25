import type { Db } from "./types";

export interface NotificationLogRow {
  version_id: number;
  threshold_days: number;
  sent_at: string;
}

export function listNotificationLog(db: Db): Promise<NotificationLogRow[]> {
  return db.select<NotificationLogRow[]>("SELECT * FROM notification_log");
}

export async function markNotified(db: Db, versionId: number, thresholds: number[]): Promise<void> {
  for (const t of thresholds) {
    await db.execute("INSERT OR IGNORE INTO notification_log (version_id, threshold_days) VALUES ($1, $2)", [versionId, t]);
  }
}

/** After the expiry date of a version changed, its thresholds count again from scratch. */
export async function clearNotified(db: Db, versionId: number): Promise<void> {
  await db.execute("DELETE FROM notification_log WHERE version_id = $1", [versionId]);
}
