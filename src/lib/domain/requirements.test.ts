import { describe, expect, it } from "vitest";
import { buildOverview } from "./overview";
import { checkRole, isRoleId, matches, REQUIREMENTS, ROLES } from "./requirements";
import type { Category, DocumentClass, DocumentVersion } from "./types";

const cls = (id: number, name: string, category: Category): DocumentClass => ({ id, name, category, created_at: "" });
const ver = (id: number, class_id: number, expiry: string | null): DocumentVersion => ({
  id, class_id, issue_date: "2020-01-01", expiry_date: expiry, issuing_authority: null, document_number: null, notes: null, created_at: "", updated_at: "", files: [],
});
const TODAY = "2026-10-26";

const classes = [
  cls(1, "Basic Safety Training", "STCW"),
  cls(2, "Medical First Aid", "STCW"),
  cls(3, "Zeevaartmedische keuring", "Medical"),
  cls(4, "Paspoort", "Identity"),
  cls(5, "Algemeen Certificaat Maritieme Radiocommunicatie (GOC)", "STCW"),
  cls(6, "Security Awareness", "STCW"),
  cls(7, "Staff ID", "Other"),
];
const versions = [ver(1, 1, "2030-02-07"), ver(2, 2, "2026-11-10"), ver(3, 3, "2026-01-01"), ver(4, 4, "2029-01-10"), ver(5, 5, null), ver(6, 6, null), ver(7, 7, null)];
const items = buildOverview(classes, versions, TODAY);
const byName = (n: string) => items.find((i) => i.documentClass.name === n)!;

describe("requirements per role", () => {
  it("recognizes documents by name or category, but not look-alikes", () => {
    expect(matches(REQUIREMENTS.bst, byName("Basic Safety Training"))).toBe(true);
    expect(matches(REQUIREMENTS.medical, byName("Zeevaartmedische keuring"))).toBe(true);
    expect(matches(REQUIREMENTS.medical, byName("Medical First Aid"))).toBe(false);
    expect(matches(REQUIREMENTS.goc, byName("Algemeen Certificaat Maritieme Radiocommunicatie (GOC)"))).toBe(true);
    expect(matches(REQUIREMENTS.aff, byName("Staff ID"))).toBe(false);
    expect(matches(REQUIREMENTS.passport, byName("Paspoort"))).toBe(true);
  });

  it("reports valid, soon, expired and missing for a role", () => {
    const states = Object.fromEntries(checkRole("deckRating", items).map((c) => [c.requirement.id, c.state]));
    expect(states).toEqual({ bst: "valid", sa: "valid", medical: "expired", passport: "valid", dischargeBook: "missing" });
    const oow = Object.fromEntries(checkRole("oow", items).map((c) => [c.requirement.id, c.state]));
    expect(oow.mfa).toBe("soon");
    expect(oow.coc).toBe("missing");
    expect(oow.goc).toBe("valid");
  });

  it("knows its roles", () => {
    expect(isRoleId("oowTanker")).toBe(true);
    expect(isRoleId("toString")).toBe(false);
    expect(ROLES.oowTanker).toContain("tankerBasic");
  });
});
