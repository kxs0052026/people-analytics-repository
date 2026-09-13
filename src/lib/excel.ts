import * as XLSX from "xlsx";

/**
 * Parses the first worksheet of an .xlsx/.xls workbook into the same
 * string[][] shape parseCsv() produces, so both formats can flow through
 * the same header-mapping / record-building pipeline.
 */
export function parseExcel(data: ArrayBuffer): string[][] {
  const workbook = XLSX.read(data, { type: "array", cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];

  const sheet = workbook.Sheets[firstSheetName];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false, // return formatted display strings, not raw cell values
    defval: "",
  });

  return rows.map((row) =>
    row.map((cell) => (cell === null || cell === undefined ? "" : String(cell)))
  );
}
