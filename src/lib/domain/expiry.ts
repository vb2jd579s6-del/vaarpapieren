import { daysBetween } from "./dates";

export type ExpiryStatus = "no-expiry" | "valid" | "warning" | "critical" | "expired";

export const WARNING_DAYS = 90;
export const CRITICAL_DAYS = 30;

/** Days until the expiry date: negative when expired, 0 on the expiry day, null when it never expires. */
export function daysUntilExpiry(expiryDate: string | null, today: string): number | null {
  if (!expiryDate) return null;
  return daysBetween(today, expiryDate);
}

export function expiryStatus(daysLeft: number | null): ExpiryStatus {
  if (daysLeft === null) return "no-expiry";
  if (daysLeft < 0) return "expired";
  if (daysLeft <= CRITICAL_DAYS) return "critical";
  if (daysLeft <= WARNING_DAYS) return "warning";
  return "valid";
}
