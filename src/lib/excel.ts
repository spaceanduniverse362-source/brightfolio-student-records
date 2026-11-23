/** Spreadsheet helpers. The xlsx library loads on demand in the browser only. */

export type SheetRows = (string | number | null)[][];

export async function readSpreadsheet(file: File): Promise<Record<string, unknown>[]> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const first = wb.SheetNames[0];
  if (!first) return [];
  const ws = wb.Sheets[first]!;
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null, raw: true });
}

export async function downloadWorkbook(
  filename: string,
  sheets: { name: string; rows: SheetRows; widths?: number[] }[],
) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.rows);
    if (s.widths) ws["!cols"] = s.widths.map((w) => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }
  XLSX.writeFile(wb, filename);
}

/** Case/space-insensitive lookup of a column in an imported row. */
export function pick(row: Record<string, unknown>, ...names: string[]): unknown {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const keys = Object.keys(row);
  for (const n of names) {
    const k = keys.find((key) => norm(key) === norm(n));
    if (k !== undefined && row[k] !== null && row[k] !== "") return row[k];
  }
  return null;
}

export function toDateString(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  const d = new Date(s);
  if (/^\d{4}-\d{2}-\d{2}/.test(s) && !Number.isNaN(d.getTime())) return s.slice(0, 10);
  return null;
}

export function downloadText(filename: string, content: string, type = "application/json") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Every sheet as raw rows (arrays), for class lists with title rows above the header. */
export async function readWorkbookSheets(file: File): Promise<{ name: string; rows: unknown[][] }[]> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  return wb.SheetNames.map((name) => ({
    name,
    rows: XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name]!, { header: 1, defval: null, raw: true, blankrows: false }),
  }));
}
