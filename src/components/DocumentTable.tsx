import { t } from "../i18n";
import { formatDate } from "../lib/domain/dates";
import type { OverviewItem } from "../lib/domain/overview";
import { expiryText } from "../lib/expiryText";
import { DocumentActions, type VersionHandlers } from "./DocumentActions";
import { StatusBadge } from "./StatusBadge";
import { useVersionSelection, VersionNavigator } from "./VersionNavigator";

function DocumentRow({ item, handlers }: { item: OverviewItem; handlers: VersionHandlers }) {
  const { documentClass, versions, status } = item;
  const { version, index, isCurrent, older, newer } = useVersionSelection(item);
  const shownStatus = isCurrent ? status : "superseded";

  return (
    <tr className={`status-${shownStatus}`}>
      <td>
        <strong>{documentClass.name}</strong>
        <VersionNavigator index={index} total={versions.length} older={older} newer={newer} />
      </td>
      <td>{t.categories[documentClass.category]}</td>
      <td>{formatDate(version.issue_date)}</td>
      <td>
        <span className={isCurrent && status === "expired" ? "struck" : undefined}>{formatDate(version.expiry_date) || "—"}</span>
        <div className={`small expiry-${shownStatus}`}>
          {isCurrent ? expiryText(item.daysLeft) : t.version.replacedBy(formatDate(versions[index - 1].issue_date))}
        </div>
      </td>
      <td>{isCurrent ? <StatusBadge status={status} /> : <span className="badge badge-superseded">{t.version.superseded}</span>}</td>
      <td>
        <DocumentActions version={version} isCurrent={isCurrent} handlers={handlers} />
      </td>
    </tr>
  );
}

export function DocumentTable({ items, handlers }: { items: OverviewItem[]; handlers: VersionHandlers }) {
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
          <th aria-label={c.actions} />
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <DocumentRow key={item.documentClass.id} item={item} handlers={handlers} />
        ))}
      </tbody>
    </table>
  );
}
