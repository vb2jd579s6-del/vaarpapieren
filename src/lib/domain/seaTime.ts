import { daysBetween, isValidIsoDate } from "./dates";

export const VESSEL_TYPES = ["cargo", "container", "tanker", "chemical", "gas", "passenger", "offshore", "tug", "fishing", "yacht", "inland", "other"] as const;
export type VesselType = (typeof VESSEL_TYPES)[number];

export interface SeaService {
  id: number;
  vessel_name: string;
  vessel_type: VesselType | null;
  imo_number: string | null;
  rank: string | null;
  /** ISO dates; sign_off null while still aboard. */
  sign_on: string;
  sign_off: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** STCW reg. I/11: revalidating a CoC needs 12 months of sea service in the last 5 years. */
export const REVALIDATION_DAYS = 365;
export const REVALIDATION_YEARS = 5;

/** The ISO date `years` years before `iso` (29 February falls back to 28 February). */
export function yearsBefore(iso: string, years: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const candidate = `${y - years}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return isValidIsoDate(candidate) ? candidate : `${y - years}-${String(m).padStart(2, "0")}-28`;
}

/** The ISO date `months` months before `iso` (end of month when that day does not exist). */
export function monthsBefore(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const total = y * 12 + (m - 1) - months;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  for (let day = d; day >= 28; day--) {
    const candidate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (isValidIsoDate(candidate)) return candidate;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(Math.min(d, 28)).padStart(2, "0")}`;
}

type Interval = [string, string];

/** The period as [first day, last day], both counted; still aboard counts up to today. Null when it starts after today. */
function interval(s: SeaService, today: string): Interval | null {
  const end = s.sign_off && s.sign_off < today ? s.sign_off : today;
  return s.sign_on > end ? null : [s.sign_on, end];
}

const nextDay = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

/** Merges overlapping or touching periods, so a day aboard two vessels counts once. */
function merge(intervals: Interval[]): Interval[] {
  const sorted = [...intervals].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const out: Interval[] = [];
  for (const [start, end] of sorted) {
    const last = out[out.length - 1];
    if (last && start <= nextDay(last[1])) {
      if (end > last[1]) last[1] = end;
    } else out.push([start, end]);
  }
  return out;
}

const length = ([start, end]: Interval) => daysBetween(start, end) + 1;

/** Days of one period, begin and end day included. */
export function serviceDays(s: SeaService, today: string): number {
  const i = interval(s, today);
  return i ? length(i) : 0;
}

/** Unique days aboard between `from` and `to` (both included). */
export function daysInWindow(services: SeaService[], from: string, to: string): number {
  return merge(services.map((s) => interval(s, to)).filter((i): i is Interval => i !== null))
    .map(([start, end]): Interval | null => {
      const a = start < from ? from : start;
      const b = end > to ? to : end;
      return a <= b ? [a, b] : null;
    })
    .filter((i): i is Interval => i !== null)
    .reduce((sum, i) => sum + length(i), 0);
}

export interface SeaTimeSummary {
  totalDays: number;
  lastFiveYears: number;
  lastSixMonths: number;
  /** Days still needed for revalidation (0 when enough). */
  missingForRevalidation: number;
  byRank: [string, number][];
  byVesselType: [VesselType | null, number][];
  aboard: SeaService | null;
}

export function summarizeSeaTime(services: SeaService[], today: string): SeaTimeSummary {
  const total = daysInWindow(services, "1900-01-01", today);
  const lastFive = daysInWindow(services, nextDay(yearsBefore(today, REVALIDATION_YEARS)), today);
  const lastSix = daysInWindow(services, nextDay(monthsBefore(today, 6)), today);
  const sum = <K>(key: (s: SeaService) => K) => {
    const map = new Map<K, number>();
    for (const s of services) map.set(key(s), (map.get(key(s)) ?? 0) + serviceDays(s, today));
    return [...map.entries()].filter(([, d]) => d > 0).sort((a, b) => b[1] - a[1]);
  };
  return {
    totalDays: total,
    lastFiveYears: lastFive,
    lastSixMonths: lastSix,
    missingForRevalidation: Math.max(0, REVALIDATION_DAYS - lastFive),
    byRank: sum((s) => s.rank?.trim() || "—"),
    byVesselType: sum((s) => s.vessel_type),
    aboard: services.find((s) => s.sign_off === null && s.sign_on <= today) ?? null,
  };
}

/** Newest first, for the list. */
export function sortServices(services: SeaService[]): SeaService[] {
  return [...services].sort((a, b) => (a.sign_on < b.sign_on ? 1 : a.sign_on > b.sign_on ? -1 : b.id - a.id));
}
