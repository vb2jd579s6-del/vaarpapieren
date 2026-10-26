import { invoke } from "@tauri-apps/api/core";
import { t } from "../i18n";
import { buildCalendar } from "./calendar";
import { getDb } from "./db/connection";
import { getThresholds } from "./db/settings";
import type { OverviewItem } from "./domain/overview";

/** Opens the expiry dates of `items` in the default calendar app; false when none has an expiry date. */
export async function addToCalendar(items: OverviewItem[], fileName: string): Promise<boolean> {
  const dated = items.filter((i) => i.current.expiry_date && i.status !== "expired");
  if (dated.length === 0) return false;
  const ics = buildCalendar(dated, await getThresholds(await getDb()), t);
  await invoke("open_calendar_file", { name: `${fileName}.ics`, content: ics });
  return true;
}
