import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { FileDown, Printer } from "lucide-react";
import { settingsQuery, studentsQuery, subjectsQuery, useClassMarks } from "@/lib/queries";
import { classLabel, subjectsFor } from "@/lib/school";
import { computeClassResults, fmt, type ClassResultRow, type Period } from "@/lib/results";
import { downloadWorkbook } from "@/lib/excel";
import { PageHeader } from "@/components/app/PageHeader";
import { ClassPicker, Pick, inClass, type ClassSelection } from "@/components/app/ClassPicker";
import { DocHeader, SignatureBox } from "@/components/app/DocHeader";
import { EMBLEM_INK_URL } from "@/components/app/Emblem";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/rosters")({
  head: () => ({
    meta: [
      { title: "Master Rosters — Burka Harbu SSS" },
      { name: "description", content: "Printable semester and annual class rosters." },
      { property: "og:title", content: "Master Rosters — Burka Harbu SSS" },
      { property: "og:description", content: "Printable semester and annual class rosters." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RostersPage,
});

const PERIOD_LABEL: Record<Period, string> = { "1": "Semester I", "2": "Semester II", annual: "Annual" };

function pickPeriod(row: ClassResultRow, period: Period) {
  if (period === "1") return { total: row.sem1.total, average: row.sem1.average, rank: row.rank.sem1 };
  if (period === "2") return { total: row.sem2.total, average: row.sem2.average, rank: row.rank.sem2 };
  return { total: row.annual.total, average: row.annual.average, rank: row.rank.annual };
}

function cellFor(row: ClassResultRow, subjectId: string, period: Period) {
  const c = row.cells[subjectId];
  if (!c) return null;
  return period === "1" ? c.sem1 : period === "2" ? c.sem2 : c.annual;
}

function RostersPage() {
  const { data: students = [] } = useQuery(studentsQuery);
  const { data: subjects = [] } = useQuery(subjectsQuery);
  const { data: settings } = useQuery(settingsQuery);
  const [sel, setSel] = useState<ClassSelection>({ grade: 9, section: "A", stream: null });
  const [period, setPeriod] = useState<Period>("annual");
  const passMark = Number(settings?.pass_mark ?? 50);

  useEffect(() => {
    document.documentElement.classList.add("print-landscape");
    return () => document.documentElement.classList.remove("print-landscape");
  }, []);

  const sections = useMemo(
    () => [...new Set(students.filter((s) => s.grade === sel.grade).map((s) => s.section))].sort(),
    [students, sel.grade],
  );
  const classStudents = useMemo(
    () => students.filter((s) => inClass(s, sel)).sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [students, sel],
  );
  const classSubjects = useMemo(() => subjectsFor(subjects, sel.grade, sel.stream), [subjects, sel]);
  const marksQ = useClassMarks(classStudents.map((s) => s.id), sel.grade);
  const rows = useMemo(
    () => computeClassResults(classStudents, classSubjects, marksQ.data ?? [], sel.grade, passMark),
    [classStudents, classSubjects, marksQ.data, sel.grade, passMark],
  );

  const passOf = (r: ClassResultRow) => {
    const avg = pickPeriod(r, period).average;
    return avg === null ? null : avg >= passMark;
  };
  const stats = {
    total: rows.length,
    m: rows.filter((r) => r.student.gender === "M").length,
    f: rows.filter((r) => r.student.gender === "F").length,
    passM: rows.filter((r) => r.student.gender === "M" && passOf(r) === true).length,
    passF: rows.filter((r) => r.student.gender === "F" && passOf(r) === true).length,
    fail: rows.filter((r) => passOf(r) === false).length,
  };

  const title = `${PERIOD_LABEL[period]} Master Roster`;
  const cls = classLabel(sel.grade, sel.section, sel.stream);

  function exportXlsx() {
    downloadWorkbook(`roster-G${sel.grade}${sel.section}${sel.stream ? "-" + sel.stream : ""}-${period}.xlsx`, [
      {
        name: `G${sel.grade}${sel.section} ${PERIOD_LABEL[period]}`,
        rows: [
          [settings?.school_name ?? "Burka Harbu Special Secondary School"],
          [`${title} — ${cls} — ${settings?.current_academic_year ?? ""}`],
          [],
          ["No", "Student Code", "Full Name", "Sex", ...classSubjects.map((s) => s.name), "Total", "Average", "Rank", "Remark"],
          ...rows.map((r, i) => {
            const p = pickPeriod(r, period);
            const pass = passOf(r);
            return [
              i + 1, r.student.student_code, r.student.full_name, r.student.gender,
              ...classSubjects.map((s) => cellFor(r, s.id, period)),
              p.total, p.average, p.rank, pass === null ? "" : pass ? "Pass" : "Fail",
            ];
          }),
          [],
          ["Enrolled", stats.total, "Male", stats.m, "Female", stats.f],
          ["Passed", stats.passM + stats.passF, "Male", stats.passM, "Female", stats.passF, "Failed", stats.fail],
        ],
        widths: [5, 14, 30, 5, ...classSubjects.map(() => 11), 9, 9, 6, 8],
      },
    ]);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Official rosters"
        title="Master rosters"
        description="Semester and annual results with totals, averages and class rank."
        actions={
          <>
            <Button variant="outline" onClick={exportXlsx} disabled={!rows.length}><FileDown /> Excel</Button>
            <Button variant="gold" onClick={() => window.print()} disabled={!rows.length}><Printer /> Print / PDF</Button>
          </>
        }
      />
      <ClassPicker value={sel} onChange={setSel} sections={sections}>
        <Pick label="Period">
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Semester I</SelectItem>
              <SelectItem value="2">Semester II</SelectItem>
              <SelectItem value="annual">Annual</SelectItem>
            </SelectContent>
          </Select>
        </Pick>
      </ClassPicker>

      <div className="mt-6 overflow-x-auto rounded-2xl print:mt-0 print:overflow-visible print:rounded-none">
        <article className="paper-sheet relative mx-auto min-w-[900px] p-8 shadow-2xl print:min-w-0 print:p-0 print:shadow-none">
          <img src={EMBLEM_INK_URL} alt="" aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 opacity-[0.05]" />
          <DocHeader settings={settings} title={title} subtitle={`${cls} · Academic year ${settings?.current_academic_year ?? ""}`} />
          <table className="doc-table relative mt-4 text-[10px] tabular">
            <thead>
              <tr>
                <th>No</th>
                <th>ID</th>
                <th className="text-left">Full name</th>
                <th>Sex</th>
                {classSubjects.map((s) => <th key={s.id} title={s.name}>{s.code}</th>)}
                <th>Total</th>
                <th>Avg</th>
                <th>Rank</th>
                <th>Remark</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={classSubjects.length + 8} className="py-6 text-center text-paper-muted">No students in this class.</td></tr>
              )}
              {rows.map((r, i) => {
                const p = pickPeriod(r, period);
                const pass = passOf(r);
                return (
                  <tr key={r.student.id}>
                    <td className="text-center">{i + 1}</td>
                    <td className="font-mono">{r.student.student_code}</td>
                    <td className="whitespace-nowrap">{r.student.full_name}</td>
                    <td className="text-center">{r.student.gender}</td>
                    {classSubjects.map((s) => {
                      const v = cellFor(r, s.id, period);
                      return <td key={s.id} className={`text-center ${v !== null && v < passMark ? "font-semibold text-destructive" : ""}`}>{fmt(v)}</td>;
                    })}
                    <td className="text-center font-semibold">{fmt(p.total)}</td>
                    <td className="text-center font-semibold">{fmt(p.average, 2)}</td>
                    <td className="text-center font-semibold">{p.rank ?? "—"}</td>
                    <td className="text-center">{pass === null ? "—" : pass ? "Pass" : "Fail"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="relative mt-4 grid grid-cols-[auto_1fr] gap-8 text-[11px]">
            <table className="doc-table w-auto">
              <thead><tr><th></th><th>M</th><th>F</th><th>Total</th></tr></thead>
              <tbody>
                <tr><td>Enrolled</td><td className="text-center">{stats.m}</td><td className="text-center">{stats.f}</td><td className="text-center">{stats.total}</td></tr>
                <tr><td>Passed</td><td className="text-center">{stats.passM}</td><td className="text-center">{stats.passF}</td><td className="text-center">{stats.passM + stats.passF}</td></tr>
              </tbody>
            </table>
            <div className="grid grid-cols-3 items-end gap-8">
              <SignatureBox label="Homeroom teacher" />
              <SignatureBox label="Registrar" name={settings?.registrar_name} />
              <SignatureBox label="Principal" name={settings?.principal_name} />
            </div>
          </div>
          <p className="relative mt-3 text-[9px] text-paper-muted">
            Pass mark {passMark}. Average = mean of subject scores{period === "annual" ? "; annual average = mean of Semester I and II averages" : ""}. Generated {new Date().toLocaleDateString()}.
          </p>
        </article>
      </div>
    </div>
  );
}
