import { en } from "./en";
import { nl, type Messages } from "./nl";

export const LANGUAGES = { nl, en } satisfies Record<string, Messages>;
export type Language = keyof typeof LANGUAGES;
export const DEFAULT_LANGUAGE: Language = "nl";

/** Each language's name in that language, for the picker. */
export const LANGUAGE_NAMES: Record<Language, string> = { nl: "Nederlands", en: "English" };

export function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && value in LANGUAGES;
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
