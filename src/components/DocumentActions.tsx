import { t } from "../i18n";
import type { OverviewItem } from "../lib/domain/overview";
import type { DocumentFile, DocumentVersion } from "../lib/domain/types";

export interface VersionHandlers {
  onOpen: (file: DocumentFile) => void;
  onEdit: (version: DocumentVersion, isCurrent: boolean) => void;
  onDelete: (version: DocumentVersion, isCurrent: boolean) => void;
  /** Enlarge a card or row; `from` is the element it grows out of. */
  onExpand: (item: OverviewItem, versionId: number, from: HTMLElement) => void;
}

/** `openFile`: which file Open opens; the first by default, the shown one in the enlarged card. */
export function DocumentActions({
  version,
  isCurrent,
  handlers,
  openFile = version.files[0],
}: {
  version: DocumentVersion;
  isCurrent: boolean;
  handlers: VersionHandlers;
  openFile?: DocumentFile;
}) {
  return (
    <div className="doc-actions">
      <button
        className="btn btn-small"
        onClick={() => openFile && handlers.onOpen(openFile)}
        disabled={!openFile}
        title={openFile ? (openFile.original_filename ?? undefined) : t.actions.noFile}
      >
        {t.actions.open}
      </button>
      <button className="btn btn-small" onClick={() => handlers.onEdit(version, isCurrent)}>
        {t.actions.edit}
      </button>
      <button className="btn btn-small btn-danger-quiet" onClick={() => handlers.onDelete(version, isCurrent)}>
        {t.actions.delete}
      </button>
    </div>
  );
}
