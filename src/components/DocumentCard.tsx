import { t } from "../i18n";
import { formatDate } from "../lib/domain/dates";
import type { OverviewItem } from "../lib/domain/overview";
import { expiryText } from "../lib/expiryText";
import { DocumentActions, type VersionHandlers } from "./DocumentActions";
import { DocumentPreview } from "./DocumentPreview";
import { StatusBadge } from "./StatusBadge";
import { useFocus, useVersionSelection, VersionNavigator } from "./VersionNavigator";

export function DocumentCard({ item, handlers, focusVersionId }: { item: OverviewItem; handlers: VersionHandlers; focusVersionId?: number }) {
  const { documentClass, versions, status } = item;
  const { version, index, isCurrent, older, newer } = useVersionSelection(item, focusVersionId);
  const { focused, focusRef } = useFocus<HTMLElement>(item, focusVersionId);
  const shownStatus = isCurrent ? status : "superseded";

  return (
    <article
      ref={focusRef}
      className={`card clickable status-${shownStatus}${focused ? " focused" : ""}`}
      tabIndex={0}
      aria-label={documentClass.name}
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest("button, a, input")) handlers.onExpand(item, version.id, e.currentTarget);
      }}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          handlers.onExpand(item, version.id, e.currentTarget);
        }
      }}
    >
      <header className="card-head">
        <div>
          <h3>{documentClass.name}</h3>
          <span className="muted small">{t.categories[documentClass.category]}</span>
        </div>
        {isCurrent ? <StatusBadge status={status} /> : <span className="badge badge-superseded">{t.version.superseded}</span>}
      </header>
      <p className={`expiry-text expiry-${shownStatus}`}>
        {isCurrent ? expiryText(item.daysLeft) : t.version.replacedBy(formatDate(versions[index - 1].issue_date))}
      </p>
      <div className="card-body">
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
        <DocumentPreview file={version.files[0] ?? null} size="thumb" more={version.files.length - 1} />
      </div>
      {version.notes && <p className="notes small">{version.notes}</p>}
      <footer className="card-foot">
        <VersionNavigator index={index} total={versions.length} older={older} newer={newer} />
        <DocumentActions version={version} isCurrent={isCurrent} handlers={handlers} />
      </footer>
    </article>
  );
}
