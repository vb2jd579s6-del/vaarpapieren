import { useEffect, useRef, useState } from "react";
import { t } from "../i18n";
import type { OverviewItem } from "../lib/domain/overview";
import type { DocumentVersion } from "../lib/domain/types";

/** Which version of an item is shown; follows the version by id across reloads, else the current one. */
export function useVersionSelection(item: OverviewItem, focusVersionId?: number) {
  const [selectedId, setSelectedId] = useState(() =>
    item.versions.some((v) => v.id === focusVersionId) ? focusVersionId! : item.current.id,
  );
  const found = item.versions.findIndex((v) => v.id === selectedId);
  const index = found === -1 ? 0 : found;
  const version: DocumentVersion = item.versions[index];
  return {
    version,
    index,
    isCurrent: index === 0,
    /** versions are newest first, so "older" moves right in the list */
    older: index < item.versions.length - 1 ? () => setSelectedId(item.versions[index + 1].id) : undefined,
    newer: index > 0 ? () => setSelectedId(item.versions[index - 1].id) : undefined,
  };
}

/** Marks and scrolls to the item a clicked notification was about. */
export function useFocus<T extends HTMLElement>(item: OverviewItem, focusVersionId?: number) {
  const focused = focusVersionId !== undefined && item.versions.some((v) => v.id === focusVersionId);
  const focusRef = useRef<T>(null);
  useEffect(() => {
    if (focused) focusRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [focused]);
  return { focused, focusRef };
}

interface VersionNavigatorProps {
  index: number;
  total: number;
  older?: () => void;
  newer?: () => void;
}

/** ‹ Versie 1 van 3 › — left is older, right is newer, like a timeline. */
export function VersionNavigator({ index, total, older, newer }: VersionNavigatorProps) {
  if (total < 2) return null;
  return (
    <div className="version-nav">
      <button className="icon-btn small" onClick={older} disabled={!older} title={t.version.older} aria-label={t.version.older}>
        ‹
      </button>
      <span className="small">{t.version.position(total - index, total)}</span>
      <button className="icon-btn small" onClick={newer} disabled={!newer} title={t.version.newer} aria-label={t.version.newer}>
        ›
      </button>
    </div>
  );
}
