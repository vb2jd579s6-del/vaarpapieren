import type { ExpiryStatus } from "../lib/domain/expiry";
import { t } from "../i18n";

const LABEL_KEYS: Record<ExpiryStatus, keyof typeof t.status> = {
  valid: "valid",
  warning: "warning",
  critical: "critical",
  expired: "expired",
  "no-expiry": "noExpiry",
};

export function StatusBadge({ status }: { status: ExpiryStatus }) {
  return <span className={`badge badge-${status}`}>{t.status[LABEL_KEYS[status]]}</span>;
}
