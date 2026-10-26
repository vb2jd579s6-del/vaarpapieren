import { useEffect, useRef } from "react";
import { t } from "../i18n";
import { formatDate } from "../lib/domain/dates";
import type { OverviewItem } from "../lib/domain/overview";
import { expiryText } from "../lib/expiryText";
import { EXPAND_TRANSITION } from "../lib/viewTransition";
import { DocumentActions, type VersionHandlers } from "./DocumentActions";
import { DocumentPreview } from "./DocumentPreview";
import { StatusBadge } from "./StatusBadge";
import { useVersionSelection, VersionNavigator } from "./VersionNavigator";

interface ExpandedDocumentProps {
  item: OverviewItem;
  /** The version the card showed when it was clicked. */
  versionId: number;
  handlers: VersionHandlers;
  onClose: () => void;
}

/** A card enlarged over the overview: a big preview (click to open), all details and the actions. */
export function ExpandedDocument({ item, versionId, handlers, onClose }: ExpandedDocumentProps) {
  const { documentClass, versions, status } = item;
  const { version, index, isCurrent, older, newer } = useVersionSelection(item, versionId);
  const shownStatus = isCurrent ? status : "superseded";
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      // Dialogs opened from here (edit, delete) handle their own Escape.
      if (e.key === "Escape" && !document.querySelector("dialog[open]")) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="expanded-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={panelRef}
        className={`expanded card status-${shownStatus}`}
        style={{ viewTransitionName: EXPAND_TRANSITION }}
        role="dialog"
        aria-modal="true"
        aria-label={documentClass.name}
        tabIndex={-1}
      >
        <header className="card-head">
          <div>
            <h2>{documentClass.name}</h2>
            <span className="muted">{t.categories[documentClass.category]}</span>
          </div>
          <div className="expanded-head-right">
            {isCurrent ? <StatusBadge status={status} /> : <span className="badge badge-superseded">{t.version.superseded}</span>}
            <button className="icon-btn" onClick={onClose} title={t.preview.close} aria-label={t.preview.close}>
              ✕
            </button>
          </div>
        </header>

        <div className="expanded-body">
          <DocumentPreview version={version} size="large" onOpen={() => handlers.onOpen(version)} />
          <div className="expanded-details">
            <p className={`expiry-text expiry-${shownStatus}`}>
              {isCurrent ? expiryText(item.daysLeft) : t.version.replacedBy(formatDate(versions[index - 1].issue_date))}
            </p>
            <dl className="facts">
              <dt>{t.overview.issued}</dt>
              <dd>{formatDate(version.issue_date)}</dd>
              <dt>{t.overview.expires}</dt>
              <dd className={isCurrent && status === "expired" ? "struck" : undefined}>{formatDate(version.expiry_date) || "—"}</dd>
              {version.issuing_authority && (
                <>
                  <dt>{t.overview.authority}</dt>
                  <dd>{version.issuing_authority}</dd>
                </>
              )}
              {version.document_number && (
                <>
                  <dt>{t.overview.number}</dt>
                  <dd>{version.document_number}</dd>
                </>
              )}
            </dl>
            {version.notes && <p className="notes">{version.notes}</p>}
          </div>
        </div>

        <footer className="card-foot">
          <VersionNavigator index={index} total={versions.length} older={older} newer={newer} />
          <DocumentActions version={version} isCurrent={isCurrent} handlers={handlers} />
        </footer>
      </div>
    </div>
  );
}
