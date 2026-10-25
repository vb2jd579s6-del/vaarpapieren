import { beforeEach, describe, expect, it, vi } from "vitest";
import { listClasses } from "./db/classes";
import { createTestDb } from "./db/testDb";
import type { Db } from "./db/types";
import { listVersions } from "./db/versions";
import { saveNewDocument } from "./documents";
import type { DocumentForm } from "./domain/documentForm";
import { importDocumentFile, removeDocumentFile } from "./files";

vi.mock("./files", () => ({
  importDocumentFile: vi.fn(async () => ({ file_path: "files/1.pdf", original_filename: "BST.pdf" })),
  removeDocumentFile: vi.fn(async () => {}),
}));

const form: DocumentForm = {
  classChoice: "new",
  newClassName: "Basic Safety Training",
  newClassCategory: "STCW",
  issuingAuthority: " Falck ",
  documentNumber: "",
  issueDate: "01-11-2021",
  noExpiry: false,
  expiryDate: "01-11-2026",
  notes: "",
};
const valid = { issueDate: "2021-11-01", expiryDate: "2026-11-01" };

describe("saveNewDocument", () => {
  let db: Db;
  beforeEach(() => {
    db = createTestDb();
    vi.clearAllMocks();
  });

  it("creates the class and the version with the copied file", async () => {
    const { classId } = await saveNewDocument(db, form, valid, "/Users/me/BST.pdf");
    expect(importDocumentFile).toHaveBeenCalledWith("/Users/me/BST.pdf");
    expect(await listVersions(db)).toMatchObject([
      { class_id: classId, issuing_authority: "Falck", document_number: null, file_path: "files/1.pdf", original_filename: "BST.pdf" },
    ]);
  });

  it("adds a version to an existing class without a file", async () => {
    const { classId } = await saveNewDocument(db, form, valid, null);
    await saveNewDocument(db, { ...form, classChoice: classId }, { issueDate: "2026-11-01", expiryDate: "2031-11-01" }, null);
    expect(await listClasses(db)).toHaveLength(1);
    expect(await listVersions(db)).toHaveLength(2);
  });

  it("undoes the new class and the copied file when the version cannot be saved", async () => {
    await expect(saveNewDocument(db, form, { issueDate: "2021-11-01", expiryDate: "2020-01-01" }, "/x.pdf")).rejects.toThrow();
    expect(await listClasses(db)).toEqual([]);
    expect(removeDocumentFile).toHaveBeenCalledWith("files/1.pdf");
  });
});
