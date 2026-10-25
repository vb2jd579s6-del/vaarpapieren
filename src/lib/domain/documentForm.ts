import { parseDisplayDate } from "./dates";
import type { Category } from "./types";

/** What the Add form holds; dates as typed by the user (dd-mm-yyyy). */
export interface DocumentForm {
  /** Existing class id, or "new". */
  classChoice: number | "new";
  newClassName: string;
  newClassCategory: Category | "";
  issuingAuthority: string;
  documentNumber: string;
  issueDate: string;
  noExpiry: boolean;
  expiryDate: string;
  notes: string;
}

export type FormError =
  | "classNameRequired"
  | "classNameExists"
  | "categoryRequired"
  | "issueDateRequired"
  | "invalidDate"
  | "expiryDateRequired"
  | "expiryBeforeIssue";

export type FormErrors = Partial<Record<"className" | "category" | "issueDate" | "expiryDate", FormError>>;

export interface ValidDocument {
  issueDate: string;
  expiryDate: string | null;
}

export function validateDocumentForm(
  form: DocumentForm,
  existingClassNames: string[],
): { errors: FormErrors; valid: ValidDocument | null } {
  const errors: FormErrors = {};

  if (form.classChoice === "new") {
    const name = form.newClassName.trim().toLocaleLowerCase("nl");
    if (!name) errors.className = "classNameRequired";
    else if (existingClassNames.some((n) => n.trim().toLocaleLowerCase("nl") === name)) errors.className = "classNameExists";
    if (!form.newClassCategory) errors.category = "categoryRequired";
  }

  const issueDate = parseDisplayDate(form.issueDate);
  if (!form.issueDate.trim()) errors.issueDate = "issueDateRequired";
  else if (!issueDate) errors.issueDate = "invalidDate";

  let expiryDate: string | null = null;
  if (!form.noExpiry) {
    expiryDate = parseDisplayDate(form.expiryDate);
    if (!form.expiryDate.trim()) errors.expiryDate = "expiryDateRequired";
    else if (!expiryDate) errors.expiryDate = "invalidDate";
    else if (issueDate && expiryDate < issueDate) errors.expiryDate = "expiryBeforeIssue";
  }

  const ok = Object.keys(errors).length === 0 && issueDate !== null;
  return { errors, valid: ok ? { issueDate, expiryDate } : null };
}
