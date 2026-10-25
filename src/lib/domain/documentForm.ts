import { formatDate, parseDisplayDate } from "./dates";
import type { Category, DocumentClass, DocumentVersion } from "./types";

/** The fields of one version as the form holds them; dates as typed by the user (dd-mm-yyyy). */
export interface VersionFields {
  issuingAuthority: string;
  documentNumber: string;
  issueDate: string;
  noExpiry: boolean;
  expiryDate: string;
  notes: string;
}

/** The Add form. */
export interface DocumentForm extends VersionFields {
  /** Existing class id, or "new". */
  classChoice: number | "new";
  newClassName: string;
  newClassCategory: Category | "";
}

/** The Edit form: class name and category apply to all versions of the class. */
export interface EditForm extends VersionFields {
  className: string;
  category: Category;
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

export interface Validation {
  errors: FormErrors;
  valid: ValidDocument | null;
}

const normalizeName = (name: string) => name.trim().toLocaleLowerCase("nl");

function classNameError(name: string, otherClassNames: string[]): FormError | undefined {
  if (!normalizeName(name)) return "classNameRequired";
  if (otherClassNames.some((n) => normalizeName(n) === normalizeName(name))) return "classNameExists";
  return undefined;
}

function validateDates(fields: VersionFields, errors: FormErrors): ValidDocument | null {
  const issueDate = parseDisplayDate(fields.issueDate);
  if (!fields.issueDate.trim()) errors.issueDate = "issueDateRequired";
  else if (!issueDate) errors.issueDate = "invalidDate";

  let expiryDate: string | null = null;
  if (!fields.noExpiry) {
    expiryDate = parseDisplayDate(fields.expiryDate);
    if (!fields.expiryDate.trim()) errors.expiryDate = "expiryDateRequired";
    else if (!expiryDate) errors.expiryDate = "invalidDate";
    else if (issueDate && expiryDate < issueDate) errors.expiryDate = "expiryBeforeIssue";
  }
  return issueDate ? { issueDate, expiryDate } : null;
}

const result = (errors: FormErrors, dates: ValidDocument | null): Validation => ({
  errors,
  valid: Object.keys(errors).length === 0 ? dates : null,
});

export function validateDocumentForm(form: DocumentForm, existingClassNames: string[]): Validation {
  const errors: FormErrors = {};
  if (form.classChoice === "new") {
    errors.className = classNameError(form.newClassName, existingClassNames);
    if (!form.newClassCategory) errors.category = "categoryRequired";
  }
  const dates = validateDates(form, errors);
  return result(withoutEmpty(errors), dates);
}

/** `otherClassNames`: the names of all classes except the one being edited. */
export function validateEditForm(form: EditForm, otherClassNames: string[]): Validation {
  const errors: FormErrors = { className: classNameError(form.className, otherClassNames) };
  const dates = validateDates(form, errors);
  return result(withoutEmpty(errors), dates);
}

function withoutEmpty(errors: FormErrors): FormErrors {
  return Object.fromEntries(Object.entries(errors).filter(([, v]) => v !== undefined));
}

/** Prefills the Edit form from a stored class and version. */
export function editFormFrom(documentClass: DocumentClass, version: DocumentVersion): EditForm {
  return {
    className: documentClass.name,
    category: documentClass.category,
    issuingAuthority: version.issuing_authority ?? "",
    documentNumber: version.document_number ?? "",
    issueDate: formatDate(version.issue_date),
    noExpiry: version.expiry_date === null,
    expiryDate: formatDate(version.expiry_date),
    notes: version.notes ?? "",
  };
}
