/**
 * Turns uploaded spreadsheets into student rows. Handles both the app's own template
 * (one header row with Student Code, Full Name, ...) and school class lists: one sheet
 * per class, a "GRADE 10A" title above the header, and Name / F.Name / G.Father columns.
 */
import { defaultStream, parseGender, parseStream, type Stream } from "./school";

export type ImportRow = {
  student_code: string | null;
  full_name: string;
  gender: "M" | "F";
  grade: number;
  section: string;
  stream: Stream | null;
  date_of_birth: string | null;
  admission_number: string | null;
  academic_year: string;
};

const norm = (v: unknown) => String(v ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const clean = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim();
const capital = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

const COLS = {
  no: ["no", "number", "sno", "lakk", "lakkoofsa"],
  code: ["studentcode", "code", "id", "studentid"],
  full: ["fullname", "studentname", "maqaaguutuu"],
  first: ["name", "firstname", "maqaa"],
  father: ["fname", "fathername", "fathersname", "maqaaabbaa"],
  grandfather: ["gfather", "gfname", "grandfather", "grandfathername", "gfathername", "maqaaakaakayyuu"],
  gender: ["gender", "sex", "saala", "koorniyaa"],
  grade: ["grade", "kutaa"],
  section: ["section", "sec", "daree"],
  stream: ["stream"],
  dob: ["dateofbirth", "dob", "birthdate"],
  admission: ["admissionnumber", "admissionno"],
  year: ["academicyear", "year"],
} as const;

/** "GRADE 10A", "Grade 11 - B", or a sheet named "9A" / "12 C". */
export function classFromText(text: string): { grade: number; section: string } | null {
  const m = /(?:grade|kutaa)?\s*(9|1[0-2])\s*[-–]?\s*([A-H])\b/i.exec(text.trim());
  if (!m) return null;
  if (!/grade|kutaa/i.test(text) && !/^\s*(9|1[0-2])\s*[-–]?\s*[A-H]\s*$/i.test(text)) return null;
  return { grade: Number(m[1]), section: m[2]!.toUpperCase() };
}

function toDate(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const s = clean(v);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
}

export function parseClassSheets(
  sheets: { name: string; rows: unknown[][] }[],
  academicYear: string,
): { rows: ImportRow[]; errors: string[] } {
  const rows: ImportRow[] = [];
  const errors: string[] = [];
  for (const sheet of sheets) {
    const headerIdx = sheet.rows.findIndex(
      (r, i) => i < 15 && r.some((c) => [...COLS.full, ...COLS.first].includes(norm(c) as never)),
    );
    if (headerIdx < 0) continue;
    const header = sheet.rows[headerIdx]!.map(norm);
    const col = (names: readonly string[]) => header.findIndex((h) => names.includes(h));
    const c = Object.fromEntries(Object.entries(COLS).map(([k, v]) => [k, col(v)])) as Record<keyof typeof COLS, number>;
    let sheetClass = classFromText(sheet.name);
    for (const r of sheet.rows.slice(0, headerIdx)) {
      for (const cell of r) sheetClass = classFromText(clean(cell)) ?? sheetClass;
    }
    const get = (r: unknown[], i: number) => (i >= 0 ? r[i] : null);

    sheet.rows.slice(headerIdx + 1).forEach((r, i) => {
      const line = `${sheet.name} row ${headerIdx + i + 2}`;
      if (c.no >= 0 && !/^\d+$/.test(clean(get(r, c.no)))) return; // totals / footer rows
      const full =
        c.full >= 0
          ? clean(get(r, c.full))
          : [c.first, c.father, c.grandfather].map((k) => capital(clean(get(r, k)))).filter(Boolean).join(" ");
      if (!full) return;
      const gender = parseGender(get(r, c.gender));
      const grade = Number(get(r, c.grade) ?? sheetClass?.grade);
      const section = (clean(get(r, c.section)) || sheetClass?.section || "A").toUpperCase().slice(0, 4);
      if (!gender) return void errors.push(`${line}: Sex must be M or F (${full})`);
      if (![9, 10, 11, 12].includes(grade)) return void errors.push(`${line}: no Grade 9–12 found (${full})`);
      const stream = grade >= 11 ? (parseStream(get(r, c.stream)) ?? defaultStream(grade, section)) : null;
      const code = clean(get(r, c.code)).slice(0, 40);
      const admission = clean(get(r, c.admission));
      rows.push({
        student_code: code || null,
        full_name: full.slice(0, 120),
        gender,
        grade,
        section,
        stream,
        date_of_birth: toDate(get(r, c.dob)),
        admission_number: admission ? admission.slice(0, 40) : null,
        academic_year: clean(get(r, c.year)).slice(0, 20) || academicYear,
      });
    });
  }
  return { rows, errors };
}

/** "2019 E.C." -> "BH19-" */
export function codePrefix(academicYear: string): string {
  const m = /(\d{2})(\d{2})/.exec(academicYear);
  return `BH${m ? m[2] : "00"}-`;
}

/**
 * Gives every row a student code: keeps codes from the file, reuses the code of an existing
 * student with the same name and class, otherwise continues the BHyy-0001 sequence.
 */
export function assignCodes(
  rows: ImportRow[],
  existing: { student_code: string; full_name: string; grade: number; section: string }[],
  prefix: string,
): (ImportRow & { student_code: string })[] {
  const key = (n: string, g: number, s: string) => `${n.toLowerCase()}|${g}|${s}`;
  const known = new Map(existing.map((e) => [key(e.full_name, e.grade, e.section), e.student_code]));
  const used = new Set(existing.map((e) => e.student_code));
  let next =
    Math.max(
      0,
      ...existing
        .filter((e) => e.student_code.startsWith(prefix))
        .map((e) => Number(e.student_code.slice(prefix.length)) || 0),
    ) + 1;
  return rows.map((r) => {
    let code = r.student_code ?? known.get(key(r.full_name, r.grade, r.section)) ?? null;
    if (!code) {
      while (used.has(`${prefix}${String(next).padStart(4, "0")}`)) next++;
      code = `${prefix}${String(next).padStart(4, "0")}`;
      next++;
    }
    used.add(code);
    return { ...r, student_code: code };
  });
}
