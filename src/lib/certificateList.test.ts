import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { en } from "../i18n/en";
import { nl } from "../i18n/nl";
import { buildCertificateList } from "./certificateList";
import { buildOverview } from "./domain/overview";
import type { DocumentClass, DocumentVersion } from "./domain/types";

const cls = (id: number, name: string, category: DocumentClass["category"]): DocumentClass => ({ id, name, category, created_at: "" });
const ver = (id: number, class_id: number, issue: string, expiry: string | null, number: string | null): DocumentVersion => ({
  id, class_id, issue_date: issue, expiry_date: expiry, issuing_authority: null, document_number: number, notes: null, created_at: "", updated_at: "", files: [],
});

const classes = [cls(1, "Basic Safety Training", "STCW"), cls(2, "Paspoort", "Identity"), cls(3, "ECDIS", "STCW"), cls(4, "Zeevaartmedische keuring – ünïcødé ✓", "Medical")];
const versions = [ver(1, 1, "2021-11-01", "2026-11-15", "NL-1"), ver(2, 2, "2019-01-10", "2029-01-10", null), ver(3, 3, "2020-05-01", "2025-05-01", "E-9"), ver(4, 4, "2024-12-01", "2026-12-20", "M-4")];
const items = buildOverview(classes, versions, "2026-10-26");

describe("certificate list PDF", () => {
  it("makes a valid PDF in the chosen language", async () => {
    for (const t of [nl, en]) {
      const bytes = await buildCertificateList(items, t, { holderName: "A. Jansen", includeExpired: true, now: new Date(2026, 9, 26) });
      const doc = await PDFDocument.load(bytes);
      expect(doc.getPageCount()).toBe(1);
      expect(doc.getTitle()).toBe(t.pdf.title);
      expect(new TextDecoder("latin1").decode(bytes.slice(0, 5))).toBe("%PDF-");
    }
  });
  it("adds pages for long lists and can leave out expired documents", async () => {
    const many = buildOverview(
      Array.from({ length: 60 }, (_, i) => cls(i + 1, `Document ${i + 1}`, "Other")),
      Array.from({ length: 60 }, (_, i) => ver(i + 1, i + 1, "2020-01-01", "2030-01-01", `N-${i}`)),
      "2026-10-26",
    );
    expect((await PDFDocument.load(await buildCertificateList(many, nl, { holderName: "", includeExpired: true }))).getPageCount()).toBe(2);
    const withoutExpired = await buildCertificateList(items, nl, { holderName: "", includeExpired: false });
    expect((await PDFDocument.load(withoutExpired)).getPageCount()).toBe(1);
  });
});
