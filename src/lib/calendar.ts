import type { Messages } from "../i18n/nl";
import { formatDate } from "./domain/dates";
import type { OverviewItem } from "./domain/overview";
import { normalizeThresholds } from "./domain/thresholds";

/** Text values in iCalendar escape backslash, semicolon, comma and newlines (RFC 5545 3.3.11). */
function escape(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Lines longer than 75 octets are folded: CRLF plus a space (RFC 5545 3.1). */
function fold(line: string): string {
  const enc = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  for (const ch of line) {
    const limit = parts.length === 0 ? 75 : 74;
    if (enc.encode(current + ch).length > limit) {
      parts.push(current);
      current = ch;
    } else current += ch;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

const ymd = (iso: string) => iso.replace(/-/g, "");
const nextDay = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};
const stamp = (now: Date) => now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/**
 * An .ics file with an all-day event on the expiry date of each given document's current
 * version, with a reminder per notification threshold. The UID is fixed per version, so
 * importing again updates the event instead of adding a second one (where the calendar app
 * supports that).
 */
export function buildCalendar(items: OverviewItem[], thresholds: number[], t: Messages, now = new Date()): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Vaarpapieren//Vaarpapieren//NL", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  for (const item of items) {
    const v = item.current;
    if (!v.expiry_date) continue;
    const details = [
      v.document_number && `${t.overview.number}: ${v.document_number}`,
      v.issuing_authority && `${t.overview.authority}: ${v.issuing_authority}`,
      `${t.overview.issued}: ${formatDate(v.issue_date)}`,
    ].filter(Boolean);
    lines.push(
      "BEGIN:VEVENT",
      `UID:vaarpapieren-version-${v.id}@vaarpapieren`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART;VALUE=DATE:${ymd(v.expiry_date)}`,
      `DTEND;VALUE=DATE:${ymd(nextDay(v.expiry_date))}`,
      `SUMMARY:${escape(t.calendar.summary(item.documentClass.name))}`,
      `DESCRIPTION:${escape(details.join("\n"))}`,
      "TRANSP:TRANSPARENT",
    );
    for (const days of normalizeThresholds(thresholds)) {
      // All-day events start at midnight; on the day itself, remind at 09:00.
      const trigger = days === 0 ? "PT9H" : `-P${days}D`;
      lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `TRIGGER;RELATED=START:${trigger}`, `DESCRIPTION:${escape(t.calendar.summary(item.documentClass.name))}`, "END:VALARM");
    }
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
