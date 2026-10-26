import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { t } from "../i18n";
import { listClasses } from "./db/classes";
import { getDb } from "./db/connection";
import { listVersions } from "./db/versions";
import { todayIso } from "./domain/dates";
import { buildOverview, countByGroup, upcomingExpiries } from "./domain/overview";
import { expiryText } from "./expiryText";

const TRAY_UPCOMING = 3;

/**
 * Brings the tray menu (with the next expiries), the macOS app menu and the Dock badge (expired +
 * expiring soon) in line with the documents and the active language. Call after anything that
 * changes those: start, saves and deletes, a language switch, and each expiry check.
 */
export async function refreshMenus(): Promise<void> {
  let upcoming: { label: string; versionId: number }[] = [];
  let attention = 0;
  try {
    const db = await getDb();
    const items = buildOverview(await listClasses(db), await listVersions(db), todayIso());
    upcoming = upcomingExpiries(items, TRAY_UPCOMING).map((i) => ({
      label: `${i.documentClass.name} — ${expiryText(i.daysLeft)}`,
      versionId: i.current.id,
    }));
    const counts = countByGroup(items);
    attention = counts.expired + counts.soon;
  } catch (err) {
    console.error("Could not read documents for the menus", err);
  }
  await Promise.all([
    invoke("set_menu_texts", { texts: { tray: { ...t.tray, upcoming }, appMenu: t.appMenu } }).catch((err) =>
      console.error("Could not set menu texts", err),
    ),
    getCurrentWindow()
      .setBadgeCount(attention > 0 ? attention : undefined)
      .catch((err) => console.error("Could not set the Dock badge", err)),
  ]);
}
