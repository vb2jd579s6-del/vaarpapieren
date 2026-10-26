import { useState } from "react";
import { t } from "../i18n";
import { getDb } from "../lib/db/connection";
import { editFormFrom, validateEditForm, type EditForm, type FormErrors } from "../lib/domain/documentForm";
import { CATEGORIES, type Category, type DocumentClass, type DocumentFile, type DocumentVersion } from "../lib/domain/types";
import { updateDocument } from "../lib/documents";
import { fileName, pickDocumentFiles } from "../lib/files";
import { ConfirmDialog } from "./ConfirmDialog";
import { FileList } from "./FileList";
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
  /** Ids of stored files marked for removal, and files on disk to add. */
  const [removeIds, setRemoveIds] = useState<number[]>([]);
  const [added, setAdded] = useState<string[]>([]);
  const [confirmingFile, setConfirmingFile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const patch = (changes: Partial<EditForm>) => {
    setForm((f) => ({ ...f, ...changes }));
    const cleared = Object.keys(changes).map((k) => ERROR_FIELD[k]);
    setErrors((errs) => Object.fromEntries(Object.entries(errs).filter(([k]) => !cleared.includes(k as keyof FormErrors))));
  };

  const nameOf = (f: DocumentFile) => f.original_filename ?? fileName(f.file_path);
  const removed = version.files.filter((f) => removeIds.includes(f.id));
  const addPaths = (paths: string[]) => setAdded((list) => [...list, ...paths.filter((p) => !list.includes(p))]);

  const chooseFiles = async () => {
    try {
      addPaths(await pickDocumentFiles(t.add.fileFilter));
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
      const { oldFilesRemoved } = await updateDocument(await getDb(), documentClass, version, form, valid, { remove: removed, add: added });
      onSaved(oldFilesRemoved ? undefined : t.edit.oldFileNotRemoved);
    } catch (e) {
      setSaveError(String(e));
      setSaving(false);
    }
  };

  const requestSave = () => {
    const { valid, errors } = validateEditForm(form, otherClassNames);
    if (valid && removed.length > 0) setConfirmingFile(true);
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

        <FileList
          items={[
            ...version.files.map((f) => ({ key: `stored-${f.id}`, name: nameOf(f), removed: removeIds.includes(f.id) })),
            ...added.map((path) => ({ key: `new-${path}`, name: fileName(path) })),
          ]}
          onAdd={chooseFiles}
          onAddPath={(path) => addPaths([path])}
          onRemove={(key) => {
            if (key.startsWith("stored-")) setRemoveIds((ids) => [...ids, Number(key.slice(7))]);
            else setAdded((list) => list.filter((p) => `new-${p}` !== key));
          }}
          onUndo={(key) => setRemoveIds((ids) => ids.filter((id) => `stored-${id}` !== key))}
          onError={(e) => setSaveError(String(e))}
        />

        <NotesInput value={form.notes} onChange={(v) => patch({ notes: v })} />
      </fieldset>

      {confirmingFile && (
        <ConfirmDialog
          title={t.edit.confirmRemoveTitle}
          confirmLabel={t.edit.confirmFileButton}
          danger
          onConfirm={save}
          onCancel={() => setConfirmingFile(false)}
        >
          <p>{t.edit.confirmFilesRemove(removed.map(nameOf))}</p>
        </ConfirmDialog>
      )}
    </Modal>
  );
}
