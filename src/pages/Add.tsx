import { useEffect, useState, type FormEvent } from "react";
import { FileList } from "../components/FileList";
import { ERROR_FIELD, errorText, Field, NotesInput, VersionInputs } from "../components/FormFields";
import { t } from "../i18n";
import { listClasses } from "../lib/db/classes";
import { getDb } from "../lib/db/connection";
import { listVersions } from "../lib/db/versions";
import { validateDocumentForm, type DocumentForm, type FormErrors } from "../lib/domain/documentForm";
import { CATEGORIES, type Category, type DocumentClass } from "../lib/domain/types";
import { saveNewDocument } from "../lib/documents";
import { fileName, pickDocumentFiles } from "../lib/files";

const EMPTY_FORM: DocumentForm = {
  classChoice: "new",
  newClassName: "",
  newClassCategory: "",
  issuingAuthority: "",
  documentNumber: "",
  issueDate: "",
  noExpiry: false,
  expiryDate: "",
  notes: "",
};

export function Add({ onSaved, initialFile = null }: { onSaved: () => void; initialFile?: string | null }) {
  const [classes, setClasses] = useState<DocumentClass[]>([]);
  const [versionCounts, setVersionCounts] = useState<Map<number, number>>(new Map());
  const [form, setForm] = useState<DocumentForm>(EMPTY_FORM);
  const [files, setFiles] = useState<string[]>(initialFile ? [initialFile] : []);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    getDb()
      .then(async (db) => {
        const [cls, versions] = await Promise.all([listClasses(db), listVersions(db)]);
        const counts = new Map<number, number>();
        for (const v of versions) counts.set(v.class_id, (counts.get(v.class_id) ?? 0) + 1);
        setClasses(cls);
        setVersionCounts(counts);
      })
      .catch((err) => setSaveError(String(err)));
  }, []);

  const patch = (changes: Partial<DocumentForm>) => {
    setForm((f) => ({ ...f, ...changes }));
    const cleared = Object.keys(changes).map((k) => ERROR_FIELD[k]);
    setErrors((errs) => Object.fromEntries(Object.entries(errs).filter(([k]) => !cleared.includes(k as keyof FormErrors))));
  };
  const set = <K extends keyof DocumentForm>(key: K, value: DocumentForm[K]) => patch({ [key]: value } as Partial<DocumentForm>);
  const err = (key: keyof FormErrors) => errorText(errors, key);
  const chosenClass = form.classChoice === "new" ? undefined : classes.find((c) => c.id === form.classChoice);

  const chooseFile = async () => {
    try {
      const picked = await pickDocumentFiles(t.add.fileFilter);
      if (picked.length) setFiles((list) => [...list, ...picked.filter((p) => !list.includes(p))]);
    } catch (e) {
      setSaveError(String(e));
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    const { errors, valid } = validateDocumentForm(form, classes.map((c) => c.name));
    setErrors(errors);
    if (!valid) return;
    setSaving(true);
    try {
      await saveNewDocument(await getDb(), form, valid, files);
      onSaved();
    } catch (e) {
      setSaveError(String(e));
      setSaving(false);
    }
  };

  return (
    <form className="form" onSubmit={submit} noValidate>
      <h2>{t.add.title}</h2>

      {saveError && (
        <div className="notice notice-error">
          <strong>{t.add.saveError}</strong>
          <div className="small">{t.common.error(saveError)}</div>
        </div>
      )}

      <Field label={t.add.documentClass}>
        <select
          className="input"
          value={String(form.classChoice)}
          onChange={(e) => set("classChoice", e.target.value === "new" ? "new" : Number(e.target.value))}
        >
          <option value="new">{t.add.newClassOption}</option>
          {classes.length > 0 && (
            <optgroup label={t.add.existingGroup}>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {t.categories[c.category]}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </Field>

      {chosenClass ? (
        <p className="notice">{t.add.existingHint(versionCounts.get(chosenClass.id) ?? 0)}</p>
      ) : (
        <div className="row">
          <Field label={t.add.className} error={err("className")}>
            <input
              className="input"
              list="class-suggestions"
              placeholder={t.add.classNamePlaceholder}
              value={form.newClassName}
              onChange={(e) => set("newClassName", e.target.value)}
              autoFocus
            />
            <datalist id="class-suggestions">
              {t.add.suggestions
                .filter((s) => !classes.some((c) => c.name.toLowerCase() === s.toLowerCase()))
                .map((s) => (
                  <option key={s} value={s} />
                ))}
            </datalist>
          </Field>
          <Field label={t.add.category} error={err("category")}>
            <select className="input" value={form.newClassCategory} onChange={(e) => set("newClassCategory", e.target.value as Category | "")}>
              <option value="">{t.add.chooseCategory}</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t.categories[c]}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}

      <VersionInputs value={form} errors={errors} onChange={patch} />

      <FileList
        items={files.map((path) => ({ key: path, name: fileName(path) }))}
        onAdd={chooseFile}
        onAddPath={(path) => setFiles((list) => (list.includes(path) ? list : [...list, path]))}
        onRemove={(path) => setFiles((list) => list.filter((p) => p !== path))}
        onError={(e) => setSaveError(String(e))}
      />

      <NotesInput value={form.notes} onChange={(v) => set("notes", v)} />

      <div className="actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? t.add.saving : t.add.save}
        </button>
        <button
          type="button"
          className="btn"
          disabled={saving}
          onClick={() => {
            setForm(EMPTY_FORM);
            setFiles([]);
            setErrors({});
            setSaveError(null);
          }}
        >
          {t.add.reset}
        </button>
      </div>
    </form>
  );
}
