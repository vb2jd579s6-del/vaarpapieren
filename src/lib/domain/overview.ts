import { daysUntilExpiry, expiryStatus, type ExpiryStatus } from "./expiry";
import type { Category, DocumentClass, DocumentVersion } from "./types";
import { groupByClass } from "./versions";

export interface OverviewItem {
  documentClass: DocumentClass;
  current: DocumentVersion;
  /** All versions of the class, newest (current) first. */
  versions: DocumentVersion[];
  daysLeft: number | null;
  status: ExpiryStatus;
}

/** One item per class that has versions, soonest expiry first; documents that never expire go last. */
export function buildOverview(classes: DocumentClass[], versions: DocumentVersion[], today: string): OverviewItem[] {
  const groups = groupByClass(versions);
  const items: OverviewItem[] = [];
  for (const documentClass of classes) {
    const list = groups.get(documentClass.id);
    if (!list?.length) continue;
    const daysLeft = daysUntilExpiry(list[0].expiry_date, today);
    items.push({ documentClass, current: list[0], versions: list, daysLeft, status: expiryStatus(daysLeft) });
  }
  return items.sort((a, b) => {
    if (a.daysLeft !== b.daysLeft) {
      if (a.daysLeft === null) return 1;
      if (b.daysLeft === null) return -1;
      return a.daysLeft - b.daysLeft;
    }
    return a.documentClass.name.localeCompare(b.documentClass.name, "nl");
  });
}

export interface OverviewFilter {
  category: Category | null;
  query: string;
}

export function filterOverview(items: OverviewItem[], { category, query }: OverviewFilter): OverviewItem[] {
  const q = query.trim().toLocaleLowerCase("nl");
  return items.filter(
    (item) =>
      (category === null || item.documentClass.category === category) &&
      (q === "" || item.documentClass.name.toLocaleLowerCase("nl").includes(q)),
  );
}
