import { t } from "../i18n";

/** "nog X dagen geldig" / "X dagen geleden verlopen" for a days-until-expiry value. */
export function expiryText(daysLeft: number | null): string {
  if (daysLeft === null) return t.expiry.noExpiry;
  if (daysLeft < 0) return t.expiry.expiredAgo(-daysLeft);
  if (daysLeft === 0) return t.expiry.expiresToday;
  return t.expiry.validFor(daysLeft);
}
