import {
  annualAverage,
  annualSubjectScore,
  cumulativeAverage,
  gpa,
  isPass,
  letterGrade,
  rankBy,
  semesterSummary,
  sum,
} from "./grading";
import { GRADES, subjectsFor, type Mark, type Student, type Subject } from "./school";

export type Period = "1" | "2" | "annual";

export type SubjectCell = { sem1: number | null; sem2: number | null; annual: number | null };

export type ClassResultRow = {
  student: Student;
  cells: Record<string, SubjectCell>;
  sem1: { total: number | null; average: number | null };
  sem2: { total: number | null; average: number | null };
  annual: { total: number | null; average: number | null };
  rank: { sem1: number | null; sem2: number | null; annual: number | null };
  pass: boolean | null;
};

export function indexMarks(marks: Mark[]) {
  const map = new Map<string, number>();
  for (const m of marks) map.set(`${m.student_id}:${m.subject_id}:${m.grade}:${m.semester}`, Number(m.score));
  return map;
}

export function computeClassResults(
  students: Student[],
  subjects: Subject[],
  marks: Mark[],
  grade: number,
  passMark: number,
): ClassResultRow[] {
  const idx = indexMarks(marks);
  const rows: ClassResultRow[] = students.map((student) => {
    const cells: Record<string, SubjectCell> = {};
    for (const sub of subjects) {
      const sem1 = idx.get(`${student.id}:${sub.id}:${grade}:1`) ?? null;
      const sem2 = idx.get(`${student.id}:${sub.id}:${grade}:2`) ?? null;
      cells[sub.id] = { sem1, sem2, annual: annualSubjectScore({ sem1, sem2 }) };
    }
    const values = Object.values(cells);
    const s1 = semesterSummary(values.map((c) => c.sem1));
    const s2 = semesterSummary(values.map((c) => c.sem2));
    const annualAvg = annualAverage(s1.average, s2.average);
    return {
      student,
      cells,
      sem1: { total: s1.total, average: s1.average },
      sem2: { total: s2.total, average: s2.average },
      annual: { total: sum(values.map((c) => c.annual)), average: annualAvg },
      rank: { sem1: null, sem2: null, annual: null },
      pass: isPass(annualAvg, passMark),
    };
  });
  const r1 = rankBy(rows, (r) => r.sem1.average);
  const r2 = rankBy(rows, (r) => r.sem2.average);
  const ra = rankBy(rows, (r) => r.annual.average);
  for (const row of rows) row.rank = { sem1: r1.get(row) ?? null, sem2: r2.get(row) ?? null, annual: ra.get(row) ?? null };
  return rows;
}

export type TranscriptYear = {
  grade: number;
  academicYear: string;
  rows: { subject: Subject; sem1: number | null; sem2: number | null; annual: number | null; letter: string | null }[];
  sem1Average: number | null;
  sem2Average: number | null;
  annualAverage: number | null;
  sem1Total: number | null;
  sem2Total: number | null;
};

export type Transcript = {
  years: TranscriptYear[];
  cumulativeAverage: number | null;
  gpa: number | null;
  yearsCompleted: number;
};

export function computeTranscript(student: Student, subjects: Subject[], marks: Mark[]): Transcript {
  const idx = indexMarks(marks);
  const allAnnual: (number | null)[] = [];
  const years: TranscriptYear[] = GRADES.map((grade) => {
    const stream = grade >= 11 ? student.stream : null;
    const withMarks = new Set(marks.filter((m) => m.grade === grade).map((m) => m.subject_id));
    const list = subjectsFor(subjects, grade, stream);
    for (const s of subjects) if (withMarks.has(s.id) && !list.includes(s)) list.push(s);
    const rows = list.map((subject) => {
      const sem1 = idx.get(`${student.id}:${subject.id}:${grade}:1`) ?? null;
      const sem2 = idx.get(`${student.id}:${subject.id}:${grade}:2`) ?? null;
      const annual = annualSubjectScore({ sem1, sem2 });
      allAnnual.push(annual);
      return { subject, sem1, sem2, annual, letter: annual === null ? null : letterGrade(annual).letter };
    });
    const s1 = semesterSummary(rows.map((r) => r.sem1));
    const s2 = semesterSummary(rows.map((r) => r.sem2));
    const yearMark = marks.find((m) => m.grade === grade && m.academic_year);
    return {
      grade,
      academicYear: yearMark?.academic_year ?? "",
      rows,
      sem1Average: s1.average,
      sem2Average: s2.average,
      sem1Total: s1.total,
      sem2Total: s2.total,
      annualAverage: annualAverage(s1.average, s2.average),
    };
  });
  const annuals = years.map((y) => y.annualAverage);
  return {
    years,
    cumulativeAverage: cumulativeAverage(annuals),
    gpa: gpa(allAnnual),
    yearsCompleted: annuals.filter((a) => a !== null).length,
  };
}

export function fmt(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined) return "—";
  return Number.isInteger(n) && digits <= 1 ? String(n) : n.toFixed(digits);
}

/** Semesters the admin has approved for students to see. */
export type Published = { sem1: boolean; sem2: boolean };

/** Hides a grade's marks for semesters that are not published yet; other grades are untouched. */
export function publishedMarks(marks: Mark[], grade: number, published: Published): Mark[] {
  return marks.filter((m) => m.grade !== grade || (m.semester === 1 ? published.sem1 : published.sem2));
}

export type ReportCard = {
  student: Pick<Student, "id" | "student_code" | "full_name" | "gender" | "grade" | "section" | "stream">;
  academicYear: string;
  passMark: number;
  classSize: number;
  subjects: { code: string; name: string; sem1: number | null; sem2: number | null; annual: number | null; letter: string | null }[];
  sem1: { total: number | null; average: number | null; rank: number | null };
  sem2: { total: number | null; average: number | null; rank: number | null };
  annual: { total: number | null; average: number | null; rank: number | null };
  pass: boolean | null;
};

export function reportCards(rows: ClassResultRow[], subjects: Subject[], passMark: number, academicYear: string): ReportCard[] {
  return rows.map((r) => ({
    student: {
      id: r.student.id,
      student_code: r.student.student_code,
      full_name: r.student.full_name,
      gender: r.student.gender,
      grade: r.student.grade,
      section: r.student.section,
      stream: r.student.stream,
    },
    academicYear,
    passMark,
    classSize: rows.length,
    subjects: subjects.map((s) => {
      const c = r.cells[s.id] ?? { sem1: null, sem2: null, annual: null };
      return { code: s.code, name: s.name, ...c, letter: c.annual === null ? null : letterGrade(c.annual).letter };
    }),
    sem1: { ...r.sem1, rank: r.rank.sem1 },
    sem2: { ...r.sem2, rank: r.rank.sem2 },
    annual: { ...r.annual, rank: r.rank.annual },
    pass: r.pass,
  }));
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]!);
}
