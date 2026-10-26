import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import type { Messages } from "../i18n/nl";
import { formatDate } from "./domain/dates";
import { statusGroup, type OverviewItem } from "./domain/overview";
import { CATEGORIES } from "./domain/types";

export interface CertificateListOptions {
  /** Printed under the title; optional. */
  holderName: string;
  includeExpired: boolean;
  /** PNG of the shield for the header; optional. */
  logoPng?: Uint8Array;
  now?: Date;
}

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 48;
const TEAL = rgb(0.04, 0.29, 0.31);
const MUTED = rgb(0.36, 0.44, 0.45);
const LINE = rgb(0.83, 0.87, 0.87);
const STATUS_COLOURS = {
  valid: rgb(0.12, 0.54, 0.3),
  warning: rgb(0.71, 0.4, 0.04),
  critical: rgb(0.75, 0.19, 0.17),
  expired: rgb(0.42, 0.46, 0.47),
  "no-expiry": rgb(0.36, 0.44, 0.45),
} as const;

/** The standard PDF fonts only cover Latin-1 (WinAnsi); replace anything else. */
const safe = (text: string) => text.replace(/[^\x20-\x7E -ÿ–—‘’“”…€]/g, "?");

function fit(text: string, font: PDFFont, size: number, width: number): string {
  let s = safe(text);
  if (font.widthOfTextAtSize(s, size) <= width) return s;
  while (s.length > 1 && font.widthOfTextAtSize(`${s}…`, size) > width) s = s.slice(0, -1);
  return `${s}…`;
}

/**
 * One-page-per-screenful list of the current version of every document, as a seafarer hands it
 * to a crewing agency: name, number, issue and expiry date and status, in the app's language.
 */
export async function buildCertificateList(items: OverviewItem[], t: Messages, opts: CertificateListOptions): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(safe(t.pdf.title));
  pdf.setCreator("Vaarpapieren");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = opts.logoPng ? await pdf.embedPng(opts.logoPng) : null;
  const now = opts.now ?? new Date();
  const today = formatDate(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`);

  const rows = items
    .filter((i) => opts.includeExpired || i.status !== "expired")
    .slice()
    .sort(
      (a, b) =>
        CATEGORIES.indexOf(a.documentClass.category) - CATEGORIES.indexOf(b.documentClass.category) ||
        a.documentClass.name.localeCompare(b.documentClass.name, "nl"),
    );

  const columns = [
    { title: t.pdf.columns.document, width: 150 },
    { title: t.pdf.columns.category, width: 68 },
    { title: t.pdf.columns.number, width: 80 },
    { title: t.pdf.columns.issued, width: 56 },
    { title: t.pdf.columns.expires, width: 56 },
    { title: t.pdf.columns.status, width: 89 },
  ];
  const ROW = 22;

  let page: PDFPage = pdf.addPage(A4);
  let y = 0;

  const header = (first: boolean) => {
    y = A4[1] - MARGIN;
    if (first) {
      if (logo) {
        const h = 46;
        page.drawImage(logo, { x: MARGIN, y: y - h, width: (h * 80) / 94, height: h });
      }
      const x = MARGIN + (logo ? 52 : 0);
      page.drawText(safe(t.pdf.title), { x, y: y - 20, size: 20, font: bold, color: TEAL });
      const sub = [opts.holderName.trim(), t.pdf.generatedOn(today)].filter(Boolean).join("  ·  ");
      page.drawText(safe(sub), { x, y: y - 38, size: 10, font: regular, color: MUTED });
      y -= 70;
    }
    let x = MARGIN;
    for (const c of columns) {
      page.drawText(fit(c.title.toUpperCase(), bold, 7.5, c.width - 6), { x, y, size: 7.5, font: bold, color: MUTED });
      x += c.width;
    }
    y -= 8;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: A4[0] - MARGIN, y }, thickness: 1, color: TEAL });
    y -= 15;
  };

  header(true);
  if (rows.length === 0) page.drawText(safe(t.pdf.empty), { x: MARGIN, y, size: 10, font: regular, color: MUTED });

  for (const item of rows) {
    if (y < MARGIN + 30) {
      page = pdf.addPage(A4);
      header(false);
    }
    const v = item.current;
    const cells = [
      { text: item.documentClass.name, font: bold },
      { text: t.categories[item.documentClass.category], font: regular },
      { text: v.document_number ?? "—", font: regular },
      { text: formatDate(v.issue_date), font: regular },
      { text: v.expiry_date ? formatDate(v.expiry_date) : "—", font: regular },
      { text: item.status === "no-expiry" ? t.pdf.status.noExpiry : t.pdf.status[statusGroup(item.status)], font: bold, color: STATUS_COLOURS[item.status] },
    ];
    let x = MARGIN;
    cells.forEach((cell, i) => {
      page.drawText(fit(cell.text, cell.font, 9, columns[i].width - 6), { x, y, size: 9, font: cell.font, color: cell.color ?? rgb(0.07, 0.16, 0.17) });
      x += columns[i].width;
    });
    page.drawLine({ start: { x: MARGIN, y: y - 8 }, end: { x: A4[0] - MARGIN, y: y - 8 }, thickness: 0.5, color: LINE });
    y -= ROW;
  }

  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    p.drawText(safe(`${t.pdf.footer}  ·  ${t.pdf.page(i + 1, pages.length)}`), { x: MARGIN, y: 28, size: 8, font: regular, color: MUTED });
  });
  return pdf.save();
}
