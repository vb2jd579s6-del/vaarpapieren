import type { ExpiryStatus } from "../lib/domain/expiry";
import { t } from "../i18n";

const LABELS: Record<ExpiryStatus, string> = {
  valid: t.status.valid,
  warning: t.status.warning,
  critical: t.status.critical,
  expired: t.status.expired,
  "no-expiry": t.status.noExpiry,
};

export function StatusBadge({ status }: { status: ExpiryStatus }) {
  return <span className={`badge badge-${status}`}>{LABELS[status]}</span>;
}
