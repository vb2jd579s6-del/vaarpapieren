import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_LANGUAGE, isLanguage, LANGUAGES, setLanguage, t } from "./index";

type Tree = { [key: string]: unknown };

/** Key paths of a text tree; function texts count as leaves. */
function keyPaths(tree: Tree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([k, v]) =>
    v && typeof v === "object" && !Array.isArray(v) ? keyPaths(v as Tree, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe("i18n", () => {
  afterEach(() => setLanguage(DEFAULT_LANGUAGE));

  it("switches the live texts", () => {
    expect(t.tabs.overview).toBe("Overzicht");
    setLanguage("en");
    expect(t.tabs.overview).toBe("Overview");
    expect(t.expiry.validFor(3)).toBe("valid for 3 more days");
  });

  it("has the same texts in every language", () => {
    const reference = keyPaths(LANGUAGES.nl).sort();
    for (const messages of Object.values(LANGUAGES)) expect(keyPaths(messages).sort()).toEqual(reference);
  });

  it("recognises supported languages only", () => {
    expect(isLanguage("en")).toBe(true);
    expect(isLanguage("de")).toBe(false);
    expect(isLanguage(undefined)).toBe(false);
  });
});
