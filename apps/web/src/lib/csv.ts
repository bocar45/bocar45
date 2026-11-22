/** CSV for spreadsheets used in Senegal/France (Excel FR): semicolon separator, UTF-8 BOM, CRLF, quoted when needed. */
export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  const cell = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    // neutralise formulas (=, +, -, @) to prevent spreadsheet injection
    const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d+$/.test(s) ? `'${s}` : s;
    return /[";\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return "﻿" + [header, ...rows].map((r) => r.map(cell).join(";")).join("\r\n") + "\r\n";
}
