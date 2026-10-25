import type { ReactNode } from "react";
import { t } from "../i18n";
import type { FormErrors, VersionFields } from "../lib/domain/documentForm";

export function Field({ label, error, hint, optional, children }: { label: string; error?: string; hint?: string; optional?: boolean; children: ReactNode }) {
  return (
    <label className={`field${error ? " has-error" : ""}`}>
      <span className="field-label">
        {label}
        {optional && <span className="muted"> ({t.add.optional})</span>}
      </span>
      {children}
      {error ? <span className="field-error">{error}</span> : hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

/** Which error a form value's change clears. */
export const ERROR_FIELD: Partial<Record<string, keyof FormErrors>> = {
  newClassName: "className",
  className: "className",
  newClassCategory: "category",
  issueDate: "issueDate",
  expiryDate: "expiryDate",
  noExpiry: "expiryDate",
};

export function errorText(errors: FormErrors, key: keyof FormErrors): string | undefined {
  const code = errors[key];
  return code ? t.add.errors[code] : undefined;
}

interface VersionInputsProps {
  value: VersionFields;
  errors: FormErrors;
  onChange: (patch: Partial<VersionFields>) => void;
}

/** Authority, number, dates; shared by the Add page and the Edit dialog. */
export function VersionInputs({ value, errors, onChange }: VersionInputsProps) {
  return (
    <>
      <div className="row">
        <Field label={t.add.issuingAuthority} optional>
          <input
            className="input"
            placeholder={t.add.issuingAuthorityPlaceholder}
            value={value.issuingAuthority}
            onChange={(e) => onChange({ issuingAuthority: e.target.value })}
          />
        </Field>
        <Field label={t.add.documentNumber} optional>
          <input className="input" value={value.documentNumber} onChange={(e) => onChange({ documentNumber: e.target.value })} />
        </Field>
      </div>

      <div className="row">
        <Field label={t.add.issueDate} error={errorText(errors, "issueDate")}>
          <input
            className="input"
            inputMode="numeric"
            placeholder={t.add.datePlaceholder}
            value={value.issueDate}
            onChange={(e) => onChange({ issueDate: e.target.value })}
          />
        </Field>
        <Field label={t.add.expiryDate} error={errorText(errors, "expiryDate")}>
          <input
            className="input"
            inputMode="numeric"
            placeholder={t.add.datePlaceholder}
            value={value.noExpiry ? "" : value.expiryDate}
            disabled={value.noExpiry}
            onChange={(e) => onChange({ expiryDate: e.target.value })}
          />
          <span className="checkbox">
            <input type="checkbox" checked={value.noExpiry} onChange={(e) => onChange({ noExpiry: e.target.checked })} />
            {t.add.noExpiry}
          </span>
        </Field>
      </div>
    </>
  );
}

export function NotesInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Field label={t.add.notes} optional>
      <textarea className="input" rows={3} value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}
