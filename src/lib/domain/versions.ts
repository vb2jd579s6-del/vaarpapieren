import type { DocumentVersion } from "./types";

/** Newest first: by issue date, ties broken by the highest id (the last one added). */
export function compareNewestFirst(a: DocumentVersion, b: DocumentVersion): number {
  if (a.issue_date !== b.issue_date) return a.issue_date < b.issue_date ? 1 : -1;
  return b.id - a.id;
}

export function sortVersionsNewestFirst(versions: DocumentVersion[]): DocumentVersion[] {
  return [...versions].sort(compareNewestFirst);
}

/** The current version of one class, or undefined when there are none. */
export function currentVersion(versions: DocumentVersion[]): DocumentVersion | undefined {
  return sortVersionsNewestFirst(versions)[0];
}

export function isSuperseded(version: DocumentVersion, classVersions: DocumentVersion[]): boolean {
  const current = currentVersion(classVersions);
  return current !== undefined && current.id !== version.id;
}

/** Group versions by class id; each list is sorted newest first. */
export function groupByClass(versions: DocumentVersion[]): Map<number, DocumentVersion[]> {
  const groups = new Map<number, DocumentVersion[]>();
  for (const v of versions) {
    const list = groups.get(v.class_id) ?? [];
    list.push(v);
    groups.set(v.class_id, list);
  }
  for (const [id, list] of groups) groups.set(id, sortVersionsNewestFirst(list));
  return groups;
}
