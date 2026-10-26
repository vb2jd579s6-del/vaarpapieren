import { listen } from "@tauri-apps/api/event";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { t } from "../../i18n";
import { listClasses } from "../db/classes";
import { getDb } from "../db/connection";
import { listNotificationLog, markNotified } from "../db/notificationLog";
import { getThresholds } from "../db/settings";
import { listVersions } from "../db/versions";
import { formatDate, todayIso } from "../domain/dates";
import { groupSentByVersion, planNotifications } from "../domain/notifications";
import { buildOverview } from "../domain/overview";
import { refreshMenus } from "../menus";

/** Event names; must match src-tauri/src/lib.rs. */
const EVENT_CHECK_NOW = "check-now";
const EVENT_OPEN_DOCUMENT = "open-document";

export async function ensurePermission(): Promise<boolean> {
  if (await isPermissionGranted()) return true;
  return (await requestPermission()) === "granted";
}

let running: Promise<number> | null = null;

/**
 * Sends the notifications that are due and logs them, so each threshold fires once per version.
 * Returns how many were sent. Overlapping calls share one run.
 */
export function runExpiryCheck(): Promise<number> {
  running ??= (async () => {
    try {
      // Without permission nothing is logged, so the reminders still come once it is granted.
      if (!(await ensurePermission())) return 0;
      const db = await getDb();
      const [classes, versions, thresholds, log] = await Promise.all([
        listClasses(db),
        listVersions(db),
        getThresholds(db),
        listNotificationLog(db),
      ]);
      const planned = planNotifications(buildOverview(classes, versions, todayIso()), thresholds, groupSentByVersion(log));
      for (const p of planned) {
        // The id is the version id: a click on the notification opens that document (see lib.rs).
        sendNotification({ id: p.versionId, title: p.className, body: t.notifications.body(p.daysLeft, formatDate(p.expiryDate)) });
        await markNotified(db, p.versionId, p.markSent);
      }
      return planned.length;
    } finally {
      running = null;
    }
  })();
  return running;
}

export async function sendTestNotification(): Promise<boolean> {
  if (!(await ensurePermission())) return false;
  sendNotification({ id: 0, title: t.notifications.testTitle, body: t.notifications.testBody });
  return true;
}

/**
 * Runs the check now, again on every tray "Nu controleren" and timer tick, and reports
 * notification clicks. Returns a function that stops listening.
 */
export function startNotificationService(onOpenDocument: (versionId: number) => void): () => void {
  const report = (err: unknown) => console.error("Expiry check failed", err);
  void refreshMenus();
  void runExpiryCheck().catch(report);
  const stops = [
    // Also the 6-hourly timer: days left change with the date, so refresh the menus and badge too.
    listen(EVENT_CHECK_NOW, () => {
      void refreshMenus();
      void runExpiryCheck().catch(report);
    }),
    listen<number>(EVENT_OPEN_DOCUMENT, (e) => onOpenDocument(e.payload)),
  ];
  return () => stops.forEach((p) => p.then((stop) => stop()));
}
