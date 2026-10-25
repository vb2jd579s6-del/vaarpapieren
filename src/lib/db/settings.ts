import type { Db } from "./types";

export const SETTING_KEYS = { overviewView: "overview_view" } as const;

export async function getSetting(db: Db, key: string): Promise<string | undefined> {
  const rows = await db.select<{ value: string }[]>("SELECT value FROM setting WHERE key = $1", [key]);
  return rows[0]?.value;
}

export async function setSetting(db: Db, key: string, value: string): Promise<void> {
  await db.execute("INSERT INTO setting (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = excluded.value", [key, value]);
}
