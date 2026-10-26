import { useState } from "react";
import { t } from "../i18n";
import { getDb } from "../lib/db/connection";
import { formatDate } from "../lib/domain/dates";
import type { DocumentClass, DocumentVersion } from "../lib/domain/types";
import { deleteDocumentVersion } from "../lib/documents";
import { ConfirmDialog } from "./ConfirmDialog";

interface DeleteDialogProps {
  documentClass: DocumentClass;
  version: DocumentVersion;
  isCurrent: boolean;
  versionCount: number;
  onClose: () => void;
  onDeleted: (warning?: string) => void;
}

export function DeleteDialog({ documentClass, version, isCurrent, versionCount, onClose, onDeleted }: DeleteDialogProps) {
  const isLast = versionCount === 1;
  const [alsoClass, setAlsoClass] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const { fileRemoved } = await deleteDocumentVersion(await getDb(), version, isLast && alsoClass);
      onDeleted(fileRemoved ? undefined : t.remove.fileNotRemoved);
    } catch (e) {
      setError(String(e));
      setBusy(false);
    }
  };

  return (
    <ConfirmDialog title={t.remove.title} confirmLabel={t.remove.confirm} danger busy={busy} onConfirm={confirm} onCancel={onClose}>
      {error && (
        <div className="notice notice-error">
          <strong>{t.remove.error}</strong>
          <div className="small">{t.common.error(error)}</div>
        </div>
      )}
      <p>{t.remove.message(documentClass.name, formatDate(version.issue_date), version.files.length > 0)}</p>
      <p className="muted">{isLast ? t.remove.lastVersion : isCurrent ? t.remove.currentWithOlder : t.remove.superseded}</p>
      {isLast && (
        <label className="checkbox">
          <input type="checkbox" checked={alsoClass} onChange={(e) => setAlsoClass(e.target.checked)} />
          {t.remove.alsoClass(documentClass.name)}
        </label>
      )}
    </ConfirmDialog>
  );
}
