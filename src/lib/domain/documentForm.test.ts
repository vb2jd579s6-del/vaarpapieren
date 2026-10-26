import { describe, expect, it } from "vitest";
import { editFormFrom, validateDocumentForm, validateEditForm, type DocumentForm, type EditForm } from "./documentForm";

const base: DocumentForm = {
  classChoice: "new",
  newClassName: "ECDIS",
  newClassCategory: "STCW",
  issuingAuthority: "",
  documentNumber: "",
  issueDate: "01-02-2024",
  noExpiry: false,
  expiryDate: "01-02-2029",
  notes: "",
};

describe("validateDocumentForm", () => {
  it("accepts a complete form and converts dates", () => {
    expect(validateDocumentForm(base, [])).toEqual({
      errors: {},
      valid: { issueDate: "2024-02-01", expiryDate: "2029-02-01" },
    });
  });
  it("requires a unique name and a category for a new class", () => {
    expect(validateDocumentForm({ ...base, newClassName: " ", newClassCategory: "" }, []).errors).toEqual({
      className: "classNameRequired",
      category: "categoryRequired",
    });
    expect(validateDocumentForm({ ...base, newClassName: "ecdis " }, ["ECDIS"]).errors).toEqual({ className: "classNameExists" });
  });
  it("ignores the new-class fields for an existing class", () => {
    expect(validateDocumentForm({ ...base, classChoice: 3, newClassName: "", newClassCategory: "" }, []).valid).not.toBeNull();
  });
  it("checks dates", () => {
    expect(validateDocumentForm({ ...base, issueDate: "" }, []).errors).toEqual({ issueDate: "issueDateRequired" });
    expect(validateDocumentForm({ ...base, issueDate: "31-02-2024" }, []).errors).toEqual({ issueDate: "invalidDate" });
    expect(validateDocumentForm({ ...base, expiryDate: "" }, []).errors).toEqual({ expiryDate: "expiryDateRequired" });
    expect(validateDocumentForm({ ...base, expiryDate: "31-01-2024" }, []).errors).toEqual({ expiryDate: "expiryBeforeIssue" });
  });
  it("allows documents that never expire", () => {
    expect(validateDocumentForm({ ...base, noExpiry: true, expiryDate: "rubbish" }, []).valid).toEqual({
      issueDate: "2024-02-01",
      expiryDate: null,
    });
  });
});

describe("validateEditForm", () => {
  const edit: EditForm = { ...base, className: "ECDIS", category: "STCW" };

  it("allows keeping the own name but not taking another class's name", () => {
    expect(validateEditForm(edit, ["Paspoort"]).valid).toEqual({ issueDate: "2024-02-01", expiryDate: "2029-02-01" });
    expect(validateEditForm({ ...edit, className: "paspoort" }, ["Paspoort"]).errors).toEqual({ className: "classNameExists" });
    expect(validateEditForm({ ...edit, className: "" }, []).errors).toEqual({ className: "classNameRequired" });
  });
  it("checks dates like the Add form", () => {
    expect(validateEditForm({ ...edit, expiryDate: "01-01-2020" }, []).errors).toEqual({ expiryDate: "expiryBeforeIssue" });
  });
  it("round-trips a stored version", () => {
    const cls = { id: 1, name: "ECDIS", category: "STCW" as const, created_at: "" };
    const version = {
      id: 1, class_id: 1, issuing_authority: null, document_number: "X1", issue_date: "2024-02-01", expiry_date: null,
      notes: null, created_at: "", updated_at: "", files: [],
    };
    const form = editFormFrom(cls, version);
    expect(form).toMatchObject({ issueDate: "01-02-2024", noExpiry: true, expiryDate: "", documentNumber: "X1", issuingAuthority: "" });
    expect(validateEditForm(form, []).valid).toEqual({ issueDate: "2024-02-01", expiryDate: null });
  });
});
