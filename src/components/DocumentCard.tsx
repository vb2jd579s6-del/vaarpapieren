import { t } from "../i18n";
import { formatDate } from "../lib/domain/dates";
import type { OverviewItem } from "../lib/domain/overview";
import { expiryText } from "../lib/expiryText";
import { StatusBadge } from "./StatusBadge";

export function DocumentCard({ item }: { item: OverviewItem }) {
  const { documentClass, current, versions, daysLeft, status } = item;
  return (
    <article className={`card status-${status}`}>
      <header className="card-head">
        <div>
          <h3>{documentClass.name}</h3>
          <span className="muted small">{t.categories[documentClass.category]}</span>
        </div>
        <StatusBadge status={status} />
      </header>
      <p className={`expiry-text expiry-${status}`}>{expiryText(daysLeft)}</p>
      <dl className="facts">
        <dt>{t.overview.issued}</dt>
        <dd>{formatDate(current.issue_date)}</dd>
        <dt>{t.overview.expires}</dt>
        <dd className={status === "expired" ? "struck" : undefined}>{formatDate(current.expiry_date) || "—"}</dd>
        {current.issuing_authority && (
          <>
            <dt>{t.overview.authority}</dt>
            <dd>{current.issuing_authority}</dd>
          </>
        )}
        {current.document_number && (
          <>
            <dt>{t.overview.number}</dt>
            <dd>{current.document_number}</dd>
          </>
        )}
      </dl>
      {versions.length > 1 && <p className="muted small">{t.overview.olderVersions(versions.length - 1)}</p>}
    </article>
  );
}
