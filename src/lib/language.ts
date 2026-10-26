import { isLanguage, setLanguage, type Language } from "../i18n";
import { getDb } from "./db/connection";
import { getSetting, setSetting, SETTING_KEYS } from "./db/settings";
import { applyMenuTexts } from "./notifications";

/** Applies the saved language before the first render; keeps the default when none is saved. */
export async function loadLanguage(): Promise<void> {
  const saved = await getSetting(await getDb(), SETTING_KEYS.language);
  if (isLanguage(saved)) setLanguage(saved);
}

/** Switches the texts, the tray and app menus and the stored choice. The caller re-renders the app. */
export async function changeLanguage(lang: Language): Promise<void> {
  setLanguage(lang);
  applyMenuTexts();
  await setSetting(await getDb(), SETTING_KEYS.language, lang);
}
