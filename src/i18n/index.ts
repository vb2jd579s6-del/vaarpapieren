import { de } from "./de";
import { en } from "./en";
import { es } from "./es";
import { fr } from "./fr";
import { nl, type Messages } from "./nl";
import { tl } from "./tl";

/** Keys are BCP 47 language tags (also used for <html lang>); the picker lists them in this order. */
export const LANGUAGES = { nl, en, de, es, fr, tl } satisfies Record<string, Messages>;
export type Language = keyof typeof LANGUAGES;
export const DEFAULT_LANGUAGE: Language = "nl";

/** Each language's name in that language, for the picker. */
export const LANGUAGE_NAMES: Record<Language, string> = {
  nl: "Nederlands",
  en: "English",
  de: "Deutsch",
  es: "Español",
  fr: "Français",
  tl: "Tagalog (Filipino)",
};

export function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(LANGUAGES, value);
}

/**
 * The active texts. A live binding: read `t.…` while rendering (never copy texts into
 * module-level constants), so switching languages takes effect on the next render.
 */
export let t: Messages = LANGUAGES[DEFAULT_LANGUAGE];
export let language: Language = DEFAULT_LANGUAGE;

export function setLanguage(lang: Language): void {
  language = lang;
  t = LANGUAGES[lang];
  if (typeof document !== "undefined") document.documentElement.lang = lang;
}
