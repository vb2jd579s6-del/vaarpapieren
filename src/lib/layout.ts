import { getDb } from "./db/connection";
import { getSetting, setSetting, SETTING_KEYS } from "./db/settings";

export const TABS_POSITIONS = ["left", "center", "right"] as const;
export type TabsPosition = (typeof TABS_POSITIONS)[number];
export const DEFAULT_TABS_POSITION: TabsPosition = "center";

export function isTabsPosition(value: unknown): value is TabsPosition {
  return TABS_POSITIONS.includes(value as TabsPosition);
}

export async function loadTabsPosition(): Promise<TabsPosition> {
  const saved = await getSetting(await getDb(), SETTING_KEYS.tabsPosition);
  return isTabsPosition(saved) ? saved : DEFAULT_TABS_POSITION;
}

export async function saveTabsPosition(position: TabsPosition): Promise<void> {
  await setSetting(await getDb(), SETTING_KEYS.tabsPosition, position);
}
