import { describe, expect, it } from "vitest";
import { extractScanInfo, findDates } from "./scanInfo";

// Made-up people and numbers, laid out like real recognised certificates.

describe("findDates", () => {
  it("reads numeric, ISO and written dates in several languages", () => {
    expect(findDates("Feb 7, 2025")).toEqual(["2025-02-07"]);
    expect(findDates("07-02-2025 tot 07.02.2030")).toEqual(["2025-02-07", "2030-02-07"]);
    expect(findDates("2025-02-07")).toEqual(["2025-02-07"]);
    expect(findDates("7 februari 2025")).toEqual(["2025-02-07"]);
    expect(findDates("7. März 2025")).toEqual(["2025-03-07"]);
    expect(findDates("7 de febrero de 2025")).toEqual(["2025-02-07"]);
    expect(findDates("07 FEB 2025")).toEqual(["2025-02-07"]);
    expect(findDates("7 février 2025")).toEqual(["2025-02-07"]);
    expect(findDates("29 / 03 / 1990 (dd/mm/yyyy)")).toEqual(["1990-03-29"]);
  });
  it("ignores impossible and garbled dates", () => {
    expect(findDates("31-02-2025")).toEqual([]);
    expect(findDates("Feb 7, 202šîŚę")).toEqual([]);
    expect(findDates("Tel no. +31 (0)118 463382")).toEqual([]);
  });
});

describe("extractScanInfo", () => {
  it("reads a training certificate with labels before and after the values", () => {
    const lines = [
      "SOME TRAINING INSTITUTE",
      "Certificate of Proficiency",
      "Name Mr /Mrs(in full):",
      "A.B. (Anna Bea) Jansen",
      "Mar 12, 1990 at Rotterdam (NL)",
      "Born (on/place/country):",
      "Geboren op/plaats/land",
      "Feb 7, 202šîŚę",
      "Issue date:",
      "Uitgiftedatum",
      "Valid from (date)",
      "Feb 7, 2025",
      "Geldig vanaf (datum)",
      "Expiry date:",
      "Feb 7, 2030",
      "Vervaldatum",
      "NL: NL002",
      "Training Institute ID",
      "ID-nummer trainingsinstituut",
      "Feb 7, 2025 at Vlissingen, the Netherlands",
      "This certificate has been issued",
      "Certificate number",
      "2025000123",
      "Certificaatnummer",
      "Tel no.： +31 （0）118 463382",
    ];
    expect(extractScanInfo(lines)).toEqual({ issueDate: "2025-02-07", expiryDate: "2030-02-07", documentNumber: "2025000123" });
  });

  it("reads labels and values on one line", () => {
    expect(
      extractScanInfo(["Date of issue: 01-11-2021", "Date of expiry: 01-11-2026", "Certificate No.: NL-4821-B", "Date of birth: 29-03-1990"]),
    ).toEqual({ issueDate: "2021-11-01", expiryDate: "2026-11-01", documentNumber: "NL-4821-B" });
  });

  it("falls back to the earliest and latest date without labels, skipping birth dates", () => {
    expect(extractScanInfo(["Geboortedatum 12-03-1990", "01-11-2021", "something", "01-11-2026"])).toEqual({
      issueDate: "2021-11-01",
      expiryDate: "2026-11-01",
    });
  });

  it("reads the passport number and expiry from the machine-readable zone", () => {
    const lines = ["P<NLDJANSEN<<ANNA<BEA<<<<<<<<<<<<<<<<<<<<<<<", "NX12345671NLD9003129F3105205<<<<<<<<<<<<<<02"];
    expect(extractScanInfo(lines)).toEqual({ documentNumber: "NX1234567", expiryDate: "2031-05-20" });
  });

  it("derives the expiry from a ticked validity period on a medical certificate", () => {
    const lines = [
      "Date of issue / Datum van afgifte",
      "14/08/2024",
      "• Until 1 year after the date of issue, age of the seafarer under 18 years",
      "X Until 2 years after the date of issue",
      "Tot 2 jaar na datum van afgifte",
    ];
    expect(extractScanInfo(lines)).toEqual({ issueDate: "2024-08-14", expiryDate: "2026-08-14" });
  });

  it("returns nothing it is not sure about", () => {
    expect(extractScanInfo(["Basic Safety Training", "Only one date: 01-11-2021"])).toEqual({});
    expect(extractScanInfo([])).toEqual({});
  });

  it("does not take an institute or phone number as the document number", () => {
    expect(extractScanInfo(["ID-nummer trainingsinstituut", "NL002", "Tel no. +31 118 463382"])).toEqual({});
  });
});
