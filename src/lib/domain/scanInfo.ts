import { isValidIsoDate } from "./dates";

/** What a scan suggests for the form; every field may be missing. Dates are ISO (YYYY-MM-DD). */
export interface ScanInfo {
  issueDate?: string;
  expiryDate?: string;
  documentNumber?: string;
}

const MONTHS: Record<string, number> = {};
const MONTH_NAMES: [number, string[]][] = [
  [1, ["jan", "january", "januari", "januar", "jänner", "janvier", "janv", "enero", "ene"]],
  [2, ["feb", "february", "februari", "februar", "février", "fevrier", "févr", "fevr", "febrero"]],
  [3, ["mar", "march", "maart", "mrt", "märz", "marz", "mars", "marzo"]],
  [4, ["apr", "april", "avril", "avr", "abril", "abr"]],
  [5, ["may", "mei", "mai", "mayo"]],
  [6, ["jun", "june", "juni", "juin", "junio"]],
  [7, ["jul", "july", "juli", "juillet", "juil", "julio"]],
  [8, ["aug", "august", "augustus", "août", "aout", "agosto", "ago"]],
  [9, ["sep", "sept", "september", "septembre", "septiembre", "setiembre"]],
  [10, ["oct", "october", "oktober", "okt", "octobre", "octubre"]],
  [11, ["nov", "november", "novembre", "noviembre"]],
  [12, ["dec", "december", "dezember", "dez", "décembre", "decembre", "diciembre", "dic"]],
];
for (const [month, names] of MONTH_NAMES) for (const name of names) MONTHS[name] = month;

const WORD = "([A-Za-zÀ-ÿ]{3,10})\\.?";
const DATE_PATTERNS: { re: RegExp; parse: (m: RegExpExecArray) => [number, number, number] | null }[] = [
  // 2025-02-07
  { re: /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g, parse: (m) => [+m[1], +m[2], +m[3]] },
  // 07-02-2025, 7.2.2025, 07/02/2025, 07 02 2025, 07 / 02 / 2025 (day first, as on European documents)
  { re: /\b(\d{1,2})(?: ?[-./] ?| )(\d{1,2})(?: ?[-./] ?| )(\d{4})\b/g, parse: (m) => [+m[3], +m[2], +m[1]] },
  // Feb 7, 2025 / February 7 2025
  { re: new RegExp(`\\b${WORD} (\\d{1,2}),? (\\d{4})\\b`, "g"), parse: (m) => (month(m[1]) ? [+m[3], month(m[1])!, +m[2]] : null) },
  // 7 Feb 2025 / 7. Februar 2025 / 7 de febrero de 2025 / 07 FEB 2025
  {
    re: new RegExp(`\\b(\\d{1,2})\\.? (?:de )?${WORD} (?:de )?(\\d{4})\\b`, "g"),
    parse: (m) => (month(m[2]) ? [+m[3], month(m[2])!, +m[1]] : null),
  },
];

function month(word: string): number | undefined {
  return MONTHS[word.toLocaleLowerCase("nl")];
}

function toIso([y, m, d]: [number, number, number]): string | null {
  const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return y >= 1950 && y <= 2100 && isValidIsoDate(iso) ? iso : null;
}

/** All dates in one line of text, as ISO, left to right. */
export function findDates(line: string): string[] {
  const found: { index: number; iso: string }[] = [];
  for (const { re, parse } of DATE_PATTERNS) {
    re.lastIndex = 0;
    for (let m = re.exec(line); m; m = re.exec(line)) {
      const parts = parse(m);
      const iso = parts ? toIso(parts) : null;
      if (iso && !found.some((f) => f.iso === iso && Math.abs(f.index - m!.index) < 4)) found.push({ index: m.index, iso });
    }
  }
  return found.sort((a, b) => a.index - b.index).map((f) => f.iso);
}

type DateKind = "issue" | "expiry" | "birth";

// Labels in the six app languages and as printed on maritime documents.
const LABELS: [DateKind, RegExp][] = [
  ["birth", /birth|born|geboren|geboorte|geburt|nacimiento|naissance|kapanganakan/i],
  ["expiry", /expir|valid (until|till|to\b)|until|vervaldatum|geldig (tot|t\/m)|g[üu]ltig bis|ablauf|caducidad|v[áa]lido hasta|valable jusqu|date d.expiration|petsa ng pag-expire/i],
  ["issue", /date of issue|issue date|issued|valid from|geldig vanaf|afgifte|afgegeven|uitgifte|uitgegeven|ausstellung|ausgestellt|g[üu]ltig ab|expedici[óo]n|expedido|d[ée]livr|petsa ng pag-isyu|inisyu/i],
];

function labelOf(line: string): DateKind | null {
  for (const [kind, re] of LABELS) if (re.test(line)) return kind;
  return null;
}

const NUMBER_LABEL =
  /(certificate|certificaat|document|passport|paspoort|licen[cs]e|card|kaart|book|boek|zeugnis|ausweis|certificado|pasaporte|libreta|certificat|passeport|livret)\s*-?\s*(no\b|nr\b|number|nummer|n[uú]mero|num[ée]ro)|^(no|nr|number|nummer|n[uú]mero|num[ée]ro)\b|certificaatnummer|documentnummer|paspoortnummer|zertifikatsnummer|n[ºo°]\s*:/i;
/** Numbers that are on the document but are not its number. */
const OTHER_NUMBER = /institu|tel|phone|fax|imo|iban|bic|kvk|reg\.?\s*vi|section|table|stcw|postcode|zip|order|ref/i;
const NUMBER_TOKEN = /\b(?=[A-Z0-9-/]*\d)[A-Z0-9][A-Z0-9-/]{3,}[A-Z0-9]\b/;

function numberIn(line: string): string | null {
  if (OTHER_NUMBER.test(line) || findDates(line).length > 0 || /^\+|\(\d|\d{2} \d{2} \d{2}/.test(line.trim())) return null;
  const m = NUMBER_TOKEN.exec(line.toUpperCase().replace(/[：:]/g, " "));
  return m && /\d/.test(m[0]) ? m[0] : null;
}

/** Passport machine-readable zone, second line: document number and expiry date. */
function readMrz(lines: string[]): ScanInfo {
  for (const raw of lines) {
    const line = raw.replace(/\s/g, "").toUpperCase();
    const m = /^([A-Z0-9<]{9})\d[A-Z<]{3}(\d{6})\d[MFX<](\d{2})(\d{2})(\d{2})\d/.exec(line);
    if (!m) continue;
    const expiry = toIso([2000 + +m[3], +m[4], +m[5]]);
    return { documentNumber: m[1].replace(/</g, ""), ...(expiry ? { expiryDate: expiry } : {}) };
  }
  return {};
}

/**
 * Finds the issue date, expiry date and document number in the text lines of a scan. A date gets
 * the meaning of the nearest label (same line, then the line before, then after, up to two away);
 * birth dates are ignored. Without labels, the earliest and latest date are issue and expiry.
 */
export function extractScanInfo(lines: string[]): ScanInfo {
  const labels = lines.map(labelOf);
  const datesPerLine = lines.map(findDates);
  const dated: { iso: string; kind: DateKind | null }[] = [];
  lines.forEach((_, i) => {
    const dates = datesPerLine[i];
    if (dates.length === 0) return;
    // A label on a line with dates of its own belongs to those dates only.
    const near = [i, i - 1, i + 1, i - 2, i + 2].find(
      (j) => j >= 0 && j < lines.length && labels[j] !== null && (j === i || datesPerLine[j].length === 0),
    );
    for (const iso of dates) dated.push({ iso, kind: near === undefined ? null : labels[near] });
  });

  const of = (kind: DateKind | null) => dated.filter((d) => d.kind === kind).map((d) => d.iso);
  const unlabelled = [...new Set(of(null))].sort();
  let issueDate: string | undefined = of("issue")[0] ?? (unlabelled.length >= 2 ? unlabelled[0] : undefined);
  let expiryDate: string | undefined = of("expiry")[0] ?? (unlabelled.length >= 2 ? unlabelled[unlabelled.length - 1] : undefined);
  if (issueDate && expiryDate && expiryDate <= issueDate) expiryDate = undefined;

  let documentNumber: string | undefined;
  for (let i = 0; i < lines.length && !documentNumber; i++) {
    if (!NUMBER_LABEL.test(lines[i])) continue;
    const afterLabel = lines[i].replace(NUMBER_LABEL, " ");
    documentNumber = numberIn(afterLabel) ?? (lines[i + 1] && numberIn(lines[i + 1])) ?? (lines[i - 1] && numberIn(lines[i - 1])) ?? undefined;
  }

  // Medical certificates: a ticked "valid until N years after the date of issue".
  if (issueDate && !expiryDate) {
    for (const line of lines) {
      const m = /^\s*[xX☒✓✔]\s+.*?(?:until|tot)\s+(\d)\s+(?:years?|jaar)\s+(?:after|na)\b/i.exec(line);
      if (m) {
        const [y, mo, d] = issueDate.split("-").map(Number);
        expiryDate = toIso([y + Number(m[1]), mo, d]) ?? undefined;
        break;
      }
    }
  }

  const mrz = readMrz(lines);
  documentNumber ??= mrz.documentNumber;
  expiryDate ??= mrz.expiryDate;
  if (issueDate && expiryDate && expiryDate <= issueDate) issueDate = undefined;

  return {
    ...(issueDate ? { issueDate } : {}),
    ...(expiryDate ? { expiryDate } : {}),
    ...(documentNumber ? { documentNumber } : {}),
  };
}
