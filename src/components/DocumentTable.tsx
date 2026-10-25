import { t } from "../i18n";
import { formatDate } from "../lib/domain/dates";
import type { OverviewItem } from "../lib/domain/overview";
import { expiryText } from "../lib/expiryText";
import { StatusBadge } from "./StatusBadge";

export function DocumentTable({ items }: { items: OverviewItem[] }) {
  const c = t.overview.columns;
  return (
    <table className="doc-table">
      <thead>
        <tr>
          <th>{c.name}</th>
          <th>{c.category}</th>
          <th>{c.issued}</th>
          <th>{c.expires}</th>
          <th>{c.status}</th>
        </tr>
      </thead>
      <tbody>
        {items.map(({ documentClass, current, versions, daysLeft, status }) => (
          <tr key={documentClass.id} className={`status-${status}`}>
            <td>
              <strong>{documentClass.name}</strong>
              {versions.length > 1 && <div className="muted small">{t.overview.olderVersions(versions.length - 1)}</div>}
            </td>
            <td>{t.categories[documentClass.category]}</td>
            <td>{formatDate(current.issue_date)}</td>
            <td>
              <span className={status === "expired" ? "struck" : undefined}>{formatDate(current.expiry_date) || "—"}</span>
              <div className={`small expiry-${status}`}>{expiryText(daysLeft)}</div>
            </td>
            <td>
              <StatusBadge status={status} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
