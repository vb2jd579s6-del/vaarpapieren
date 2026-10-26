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
import { formatDate } from "../lib/domain/dates";
import type { ScanInfo } from "../lib/domain/scanInfo";
import { fileName, pickDocumentFiles } from "../lib/files";
import { canReadScans, readScanInfo } from "../lib/scan";

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

interface AddProps {
  onSaved: () => void;
  initialFile?: string | null;
  /** Prefills a new document type (from a missing requirement). */
  initialClassName?: string;
}

export function Add({ onSaved, initialFile = null, initialClassName = "" }: AddProps) {
  const [classes, setClasses] = useState<DocumentClass[]>([]);
  const [versionCounts, setVersionCounts] = useState<Map<number, number>>(new Map());
  const [form, setForm] = useState<DocumentForm>(() => ({ ...EMPTY_FORM, newClassName: initialClassName }));
  const [files, setFiles] = useState<string[]>(initialFile ? [initialFile] : []);
  /** What the last added file suggests, or that it is being read. */
  const [scan, setScan] = useState<{ name: string; info: ScanInfo | null } | null>(null);

  /** Reads newly added files one by one until one yields something (macOS only). */
  const readNewFiles = async (paths: string[]) => {
    if (!canReadScans) return;
    for (const path of paths) {
      setScan({ name: fileName(path), info: null });
      try {
        const info = await readScanInfo(path);
        if (Object.keys(info).length > 0) {
          setScan({ name: fileName(path), info });
          return;
        }
      } catch (err) {
        console.error("Could not read the file", err);
      }
      setScan({ name: fileName(path), info: {} });
    }
  };

  const addFiles = (paths: string[]) => {
    const fresh = paths.filter((p) => !files.includes(p));
    if (fresh.length === 0) return;
    setFiles((list) => [...list, ...fresh.filter((p) => !list.includes(p))]);
    void readNewFiles(fresh);
  };

  const applyScan = (info: ScanInfo) => {
    patch({
      ...(info.issueDate ? { issueDate: formatDate(info.issueDate) } : {}),
      ...(info.expiryDate ? { expiryDate: formatDate(info.expiryDate), noExpiry: false } : {}),
      ...(info.documentNumber ? { documentNumber: info.documentNumber } : {}),
    });
    setScan(null);
  };

  // A scan handed over by the menu bar arrives as the initial file.
  useEffect(() => {
    if (initialFile) void readNewFiles([initialFile]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
      addFiles(await pickDocumentFiles(t.add.fileFilter));
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

      {scan && (
        <div className={`notice scan-notice${scan.info && Object.keys(scan.info).length === 0 ? "" : " scan-found"}`} role="status">
          {scan.info === null ? (
            <span className="muted">{t.add.scanReading}</span>
          ) : Object.keys(scan.info).length === 0 ? (
            <div className="notice-row">
              <span className="muted">{t.add.scanNothing(scan.name)}</span>
              <button type="button" className="icon-btn small" aria-label={t.add.scanDismiss} onClick={() => setScan(null)}>
                ✕
              </button>
            </div>
          ) : (
            <>
              <strong>{t.add.scanFound(scan.name)}</strong>
              <dl className="facts scan-facts">
                {scan.info.issueDate && (
                  <>
                    <dt>{t.add.issueDate}</dt>
                    <dd>{formatDate(scan.info.issueDate)}</dd>
                  </>
                )}
                {scan.info.expiryDate && (
                  <>
                    <dt>{t.add.expiryDate}</dt>
                    <dd>{formatDate(scan.info.expiryDate)}</dd>
                  </>
                )}
                {scan.info.documentNumber && (
                  <>
                    <dt>{t.add.documentNumber}</dt>
                    <dd>{scan.info.documentNumber}</dd>
                  </>
                )}
              </dl>
              <p className="field-hint">{t.add.scanCheck}</p>
              <div className="actions">
                <button type="button" className="btn btn-small btn-primary" onClick={() => applyScan(scan.info!)}>
                  {t.add.scanApply}
                </button>
                <button type="button" className="btn btn-small" onClick={() => setScan(null)}>
                  {t.add.scanDismiss}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <FileList
        items={files.map((path) => ({ key: path, name: fileName(path) }))}
        onAdd={chooseFile}
        onAddPath={(path) => addFiles([path])}
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
            setScan(null);
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
