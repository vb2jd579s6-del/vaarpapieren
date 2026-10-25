import { useState } from "react";
import { t } from "../i18n";
import { getDb } from "../lib/db/connection";
import { editFormFrom, validateEditForm, type EditForm, type FormErrors } from "../lib/domain/documentForm";
import { CATEGORIES, type Category, type DocumentClass, type DocumentVersion } from "../lib/domain/types";
import { updateDocument, type FileChange } from "../lib/documents";
import { fileName, pickDocumentFile } from "../lib/files";
import { ConfirmDialog } from "./ConfirmDialog";
import { ERROR_FIELD, errorText, Field, NotesInput, VersionInputs } from "./FormFields";
import { Modal } from "./Modal";

interface EditDialogProps {
  documentClass: DocumentClass;
  version: DocumentVersion;
  isCurrent: boolean;
  versionCount: number;
  /** Names of all other classes, to keep names unique. */
  otherClassNames: string[];
  onClose: () => void;
  /** Called after saving; `warning` is set when the edit succeeded only partly. */
  onSaved: (warning?: string) => void;
}

export function EditDialog({ documentClass, version, isCurrent, versionCount, otherClassNames, onClose, onSaved }: EditDialogProps) {
  const [form, setForm] = useState<EditForm>(() => editFormFrom(documentClass, version));
  const [errors, setErrors] = useState<FormErrors>({});
  const [fileChange, setFileChange] = useState<FileChange>({ kind: "keep" });
  const [confirmingFile, setConfirmingFile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const patch = (changes: Partial<EditForm>) => {
    setForm((f) => ({ ...f, ...changes }));
    const cleared = Object.keys(changes).map((k) => ERROR_FIELD[k]);
    setErrors((errs) => Object.fromEntries(Object.entries(errs).filter(([k]) => !cleared.includes(k as keyof FormErrors))));
  };

  const currentFileName = version.original_filename ?? (version.file_path ? fileName(version.file_path) : null);

  const chooseFile = async () => {
    try {
      const picked = await pickDocumentFile(t.add.fileFilter);
      if (picked) setFileChange({ kind: "replace", source: picked });
    } catch (e) {
      setSaveError(String(e));
    }
  };

  const save = async () => {
    setConfirmingFile(false);
    const { errors, valid } = validateEditForm(form, otherClassNames);
    setErrors(errors);
    if (!valid) return;
    setSaving(true);
    setSaveError(null);
    try {
      const { oldFileRemoved } = await updateDocument(await getDb(), documentClass, version, form, valid, fileChange);
      onSaved(oldFileRemoved ? undefined : t.edit.oldFileNotRemoved);
    } catch (e) {
      setSaveError(String(e));
      setSaving(false);
    }
  };

  const requestSave = () => {
    const { valid, errors } = validateEditForm(form, otherClassNames);
    if (valid && fileChange.kind !== "keep" && version.file_path) setConfirmingFile(true);
    else if (valid) void save();
    else setErrors(errors);
  };

  return (
    <Modal
      title={t.edit.title}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={saving}>
            {t.actions.cancel}
          </button>
          <button className="btn btn-primary" onClick={requestSave} disabled={saving}>
            {saving ? t.actions.saving : t.actions.save}
          </button>
        </>
      }
    >
      {saveError && (
        <div className="notice notice-error">
          <strong>{t.edit.saveError}</strong>
          <div className="small">{t.common.error(saveError)}</div>
        </div>
      )}

      <fieldset className="fieldset">
        <legend>{t.edit.classSection}</legend>
        <p className="field-hint">{t.edit.classHint(versionCount)}</p>
        <div className="row">
          <Field label={t.add.className} error={errorText(errors, "className")}>
            <input className="input" value={form.className} onChange={(e) => patch({ className: e.target.value })} />
          </Field>
          <Field label={t.add.category}>
            <select className="input" value={form.category} onChange={(e) => patch({ category: e.target.value as Category })}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t.categories[c]}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </fieldset>

      <fieldset className="fieldset">
        <legend>{t.edit.versionSection(isCurrent ? t.version.current : t.version.superseded)}</legend>
        <VersionInputs value={form} errors={errors} onChange={patch} />

        <Field label={t.add.file} hint={t.add.fileHint} optional>
          <div className="file-picker">
            {fileChange.kind === "keep" ? (
              <span className={currentFileName ? undefined : "muted"}>{currentFileName ?? t.add.noFile}</span>
            ) : (
              <span className="pending-change">
                {fileChange.kind === "replace" ? t.edit.fileWillBeReplaced(fileName(fileChange.source)) : t.edit.fileWillBeRemoved}
              </span>
            )}
            <button type="button" className="btn" onClick={chooseFile}>
              {currentFileName || fileChange.kind === "replace" ? t.edit.replaceFile : t.add.chooseFile}
            </button>
            {fileChange.kind === "keep" && currentFileName && (
              <button type="button" className="btn" onClick={() => setFileChange({ kind: "remove" })}>
                {t.edit.removeFile}
              </button>
            )}
            {fileChange.kind !== "keep" && (
              <button type="button" className="btn" onClick={() => setFileChange({ kind: "keep" })}>
                {t.edit.undoFileChange}
              </button>
            )}
          </div>
        </Field>

        <NotesInput value={form.notes} onChange={(v) => patch({ notes: v })} />
      </fieldset>

      {confirmingFile && currentFileName && (
        <ConfirmDialog
          title={fileChange.kind === "replace" ? t.edit.confirmReplaceTitle : t.edit.confirmRemoveTitle}
          confirmLabel={t.edit.confirmFileButton}
          danger
          onConfirm={save}
          onCancel={() => setConfirmingFile(false)}
        >
          <p>{fileChange.kind === "replace" ? t.edit.confirmFileReplace(currentFileName) : t.edit.confirmFileRemove(currentFileName)}</p>
        </ConfirmDialog>
      )}
    </Modal>
  );
}
