import type { Db } from "./types";

import { DEFAULT_THRESHOLDS, normalizeThresholds } from "../domain/thresholds";

export const SETTING_KEYS = {
  overviewView: "overview_view",
  language: "language",
  tabsPosition: "tabs_position",
  activated: "activated",
  holderName: "holder_name",
  /** Per computer: not exported, since Windows has no Touch ID. */
  lockEnabled: "lock_enabled",
  thresholds: "notification_thresholds",
  /** Set once the first-start notice about notifications was dismissed. */
  notificationsIntroDone: "notifications_intro_done",
} as const;

export async function getSetting(db: Db, key: string): Promise<string | undefined> {
  const rows = await db.select<{ value: string }[]>("SELECT value FROM setting WHERE key = $1", [key]);
  return rows[0]?.value;
}

export async function setSetting(db: Db, key: string, value: string): Promise<void> {
  await db.execute("INSERT INTO setting (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = excluded.value", [key, value]);
}

export async function getThresholds(db: Db): Promise<number[]> {
  const raw = await getSetting(db, SETTING_KEYS.thresholds);
  if (raw === undefined) return DEFAULT_THRESHOLDS;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return normalizeThresholds(parsed.filter((n): n is number => typeof n === "number"));
  } catch {
    // fall through to the defaults
  }
  return DEFAULT_THRESHOLDS;
}

export function setThresholds(db: Db, thresholds: number[]): Promise<void> {
  return setSetting(db, SETTING_KEYS.thresholds, JSON.stringify(normalizeThresholds(thresholds)));
}
