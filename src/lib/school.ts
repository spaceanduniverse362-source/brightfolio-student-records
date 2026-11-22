import type { Tables } from "@/integrations/supabase/types";

export type Student = Tables<"students">;
export type Subject = Tables<"subjects">;
export type Mark = Tables<"marks">;
export type SchoolSettings = Tables<"school_settings">;
export type Stream = "natural" | "social";

export const GRADES = [9, 10, 11, 12] as const;
export const SECTIONS = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;
export const SEMESTERS = [1, 2] as const;

export const STREAM_LABEL: Record<Stream, string> = {
  natural: "Natural Science",
  social: "Social Science",
};

export function streamLabel(stream: string | null | undefined): string {
  if (stream === "natural" || stream === "social") return STREAM_LABEL[stream];
  return "General";
}

export function hasStreams(grade: number): boolean {
  return grade >= 11;
}

/** Subjects taught in a grade, for a stream (grades 9–10 take every subject listed for them). */
export function subjectsFor(subjects: Subject[], grade: number, stream: string | null): Subject[] {
  return subjects
    .filter((s) => s.grades.includes(grade))
    .filter((s) => {
      if (!hasStreams(grade) || !stream || s.streams.length === 0) return true;
      return s.streams.includes(stream);
    })
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
}

export function parseGender(value: unknown): "M" | "F" | null {
  const v = String(value ?? "").trim().toLowerCase();
  if (["m", "male", "dhiira", "boy"].includes(v)) return "M";
  if (["f", "female", "dhalaa", "girl"].includes(v)) return "F";
  return null;
}

export function parseStream(value: unknown): Stream | null {
  const v = String(value ?? "").trim().toLowerCase();
  if (v.startsWith("nat")) return "natural";
  if (v.startsWith("soc")) return "social";
  return null;
}

export function genderLabel(g: string) {
  return g === "F" ? "Female" : "Male";
}

export function classLabel(grade: number, section: string, stream: string | null) {
  return `Grade ${grade}${section ? ` · Section ${section}` : ""}${hasStreams(grade) && stream ? ` · ${streamLabel(stream)}` : ""}`;
}

type PageResult<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/** Reads every row past the 1000-row API page size. */
export async function fetchAll<T>(page: (from: number, to: number) => PageResult<T>): Promise<T[]> {
  const size = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < size) break;
  }
  return out;
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
