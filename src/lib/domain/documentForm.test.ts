import { describe, expect, it } from "vitest";
import { validateDocumentForm, type DocumentForm } from "./documentForm";

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
