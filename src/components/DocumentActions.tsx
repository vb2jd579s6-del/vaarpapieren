import { t } from "../i18n";
import type { OverviewItem } from "../lib/domain/overview";
import type { DocumentVersion } from "../lib/domain/types";

export interface VersionHandlers {
  onOpen: (version: DocumentVersion) => void;
  onEdit: (version: DocumentVersion, isCurrent: boolean) => void;
  onDelete: (version: DocumentVersion, isCurrent: boolean) => void;
  /** Enlarge a card or row; `from` is the element it grows out of. */
  onExpand: (item: OverviewItem, versionId: number, from: HTMLElement) => void;
}

export function DocumentActions({ version, isCurrent, handlers }: { version: DocumentVersion; isCurrent: boolean; handlers: VersionHandlers }) {
  return (
    <div className="doc-actions">
      <button
        className="btn btn-small"
        onClick={() => handlers.onOpen(version)}
        disabled={!version.file_path}
        title={version.file_path ? (version.original_filename ?? undefined) : t.actions.noFile}
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
