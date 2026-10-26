import { t } from "../i18n";
import { IphoneImportButton } from "./IphoneImportButton";

export interface FileListItem {
  key: string;
  name: string;
  /** An existing file marked for removal (shown struck through, with Undo). */
  removed?: boolean;
}

interface FileListProps {
  items: FileListItem[];
  onAdd: () => void;
  onAddPath: (path: string) => void;
  onRemove: (key: string) => void;
  onUndo?: (key: string) => void;
  onError: (err: unknown) => void;
}

/** The files of a version being added or edited, with Add file… and Import from iPhone…. */
export function FileList({ items, onAdd, onAddPath, onRemove, onUndo, onError }: FileListProps) {
  return (
    <div className="field">
      <span className="field-label">
        {t.add.file} <span className="muted">({t.add.optional})</span>
      </span>
      {items.length > 0 ? (
        <ul className="file-list">
          {items.map((item) => (
            <li key={item.key} className={item.removed ? "removed" : undefined}>
              <FileGlyph />
              <span className="file-name">{item.name}</span>
              {item.removed ? (
                <>
                  <span className="pending-change">{t.edit.fileWillBeRemoved}</span>
                  {onUndo && (
                    <button type="button" className="btn btn-small" onClick={() => onUndo(item.key)}>
                      {t.edit.undoFileChange}
                    </button>
                  )}
                </>
              ) : (
                <button type="button" className="icon-btn small" title={t.add.removeFile} aria-label={t.add.removeFile} onClick={() => onRemove(item.key)}>
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <span className="muted small">{t.add.noFile}</span>
      )}
      <div className="file-picker">
        <button type="button" className="btn" onClick={onAdd}>
          {t.add.chooseFile}
        </button>
        <IphoneImportButton onFile={onAddPath} onError={onError} />
      </div>
      <span className="field-hint">{t.add.fileHint}</span>
    </div>
  );
}

function FileGlyph() {
  return (
    <svg className="file-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </svg>
  );
}
