import { RequireRole } from "@/components/app/RequireRole";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, Printer } from "lucide-react";
import { cumulativeQuery, fetchMarksForStudents, settingsQuery, studentsQuery, subjectsQuery } from "@/lib/queries";
import { genderLabel, streamLabel } from "@/lib/school";
import { GRADE_SCALE, graduationRemark, rankBy } from "@/lib/grading";
import { computeTranscript, fmt } from "@/lib/results";
import { DocHeader, SignatureBox } from "@/components/app/DocHeader";
import { EMBLEM_INK_URL } from "@/components/app/Emblem";
import { StudentPhoto } from "@/components/app/StudentPhoto";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/transcripts/$studentId")({
  head: () => ({
    meta: [
      { title: "Official Transcript — Burka Harbu SSS" },
      { name: "description", content: "Grade 9–12 cumulative official transcript." },
      { property: "og:title", content: "Official Transcript — Burka Harbu SSS" },
      { property: "og:description", content: "Grade 9–12 cumulative official transcript." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireRole role="staff">
      <TranscriptPage />
    </RequireRole>
  ),
});

function TranscriptPage() {
  const { studentId } = Route.useParams();
  const { data: students = [], isLoading } = useQuery(studentsQuery);
  const { data: subjects = [] } = useQuery(subjectsQuery);
  const { data: settings } = useQuery(settingsQuery);
  const { data: cum } = useQuery(cumulativeQuery);
  const marksQ = useQuery({
    queryKey: ["marks", "student", studentId],
    queryFn: () => fetchMarksForStudents([studentId]),
  });
  const student = students.find((s) => s.id === studentId);
  const passMark = Number(settings?.pass_mark ?? 50);

  const transcript = useMemo(
    () => (student ? computeTranscript(student, subjects, marksQ.data ?? []) : null),
    [student, subjects, marksQ.data],
  );

  const rank = useMemo(() => {
    if (!student || !cum) return null;
    const cohort = students.filter(
      (s) => s.status !== "transferred" && (s.grade === student.grade) && (s.status === student.status) && (s.stream ?? null) === (student.stream ?? null),
    );
    const r = rankBy(cohort, (s) => cum.get(s.id)?.avg ?? null);
    return { rank: r.get(cohort.find((s) => s.id === student.id)!) ?? null, of: cohort.filter((s) => cum.has(s.id)).length };
  }, [student, students, cum]);

  if (isLoading) return <p className="text-muted-foreground">Loading…</p>;
  if (!student || !transcript) {
    return (
      <div className="glass rounded-2xl p-10 text-center">
        <p>Student not found.</p>
        <Button asChild variant="outline" className="mt-4"><Link to="/transcripts">Back</Link></Button>
      </div>
    );
  }

  const verifyUrl = typeof window !== "undefined" ? `${window.location.origin}/verify/${student.verification_token}` : "";
  const issued = new Date();
  const transcriptNo = `BH-TR-${student.student_code}-${issued.getFullYear()}`;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button asChild variant="ghost"><Link to="/transcripts"><ArrowLeft /> All transcripts</Link></Button>
        <div className="flex items-center gap-3">
          <p className="hidden text-xs text-muted-foreground md:block">Tip: choose “Save as PDF” in the print dialog.</p>
          <Button variant="gold" onClick={() => window.print()}><Printer /> Print / Save PDF</Button>
        </div>
      </div>

      <div className="overflow-x-auto print:overflow-visible">
        <article className="paper-sheet relative mx-auto w-[210mm] min-h-[297mm] overflow-hidden p-[10mm] shadow-2xl print:min-h-0 print:w-auto print:p-0 print:shadow-none">
          <img src={EMBLEM_INK_URL} alt="" aria-hidden className="pointer-events-none absolute left-1/2 top-[52%] h-[150mm] w-[150mm] -translate-x-1/2 -translate-y-1/2 opacity-[0.05]" />
          <div className="relative">
            <DocHeader settings={settings} title="Official Academic Transcript · Grades 9 – 12" subtitle="Secondary School Cumulative Record" />

            <section className="mt-3 grid grid-cols-[26mm_1fr_24mm] gap-4">
              <StudentPhoto path={student.photo_path} name={student.full_name} paper className="h-[32mm] w-[26mm]" />
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 self-center text-[10.5px]">
                <Info k="Full legal name" v={student.full_name} wide />
                <Info k="Student ID" v={student.student_code} mono />
                <Info k="Admission no." v={student.admission_number ?? "—"} mono />
                <Info k="Sex" v={genderLabel(student.gender)} />
                <Info k="Date of birth" v={student.date_of_birth ?? "—"} />
                <Info k="Stream" v={streamLabel(student.stream)} />
                <Info k="Admission date" v={student.admission_date ?? "—"} />
              </dl>
              <div className="flex flex-col items-center justify-center text-center">
                <QRCodeSVG value={verifyUrl} size={80} level="M" bgColor="transparent" fgColor="currentColor" className="text-paper-accent" />
                <p className="mt-1 text-[8px] uppercase tracking-wider text-paper-muted">Scan to verify</p>
              </div>
            </section>

            <section className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
              {transcript.years.map((y) => (
                <div key={y.grade}>
                  <div className="flex items-baseline justify-between border-b border-paper-accent pb-0.5">
                    <h2 className="font-display text-[13px] font-bold text-paper-accent">Grade {y.grade}</h2>
                    <span className="text-[9px] text-paper-muted">{y.academicYear || "\u00A0"}</span>
                  </div>
                  <table className="doc-table doc-compact mt-1 text-[9px] tabular">
                    <thead>
                      <tr>
                        <th className="text-left">Subject</th>
                        <th className="w-9">Sem I</th>
                        <th className="w-9">Sem II</th>
                        <th className="w-9">Avg</th>
                        <th className="w-7">Gr</th>
                      </tr>
                    </thead>
                    <tbody>
                      {y.rows.map((r) => (
                        <tr key={r.subject.id}>
                          <td className="whitespace-nowrap">{r.subject.name}</td>
                          <td className="text-center">{fmt(r.sem1)}</td>
                          <td className="text-center">{fmt(r.sem2)}</td>
                          <td className="text-center font-semibold">{fmt(r.annual)}</td>
                          <td className="text-center">{r.letter ?? "—"}</td>
                        </tr>
                      ))}
                      <tr>
                        <td className="font-semibold">Average</td>
                        <td className="text-center font-semibold">{fmt(y.sem1Average, 2)}</td>
                        <td className="text-center font-semibold">{fmt(y.sem2Average, 2)}</td>
                        <td className="text-center font-bold text-paper-accent">{fmt(y.annualAverage, 2)}</td>
                        <td className="text-center">{y.annualAverage === null ? "—" : y.annualAverage >= passMark ? "P" : "F"}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ))}
            </section>

            <section className="mt-3 grid grid-cols-8 border border-paper-border text-center text-[9.5px]">
              {transcript.years.map((y) => (
                <Summary key={y.grade} k={`Grade ${y.grade}`} v={fmt(y.annualAverage, 2)} />
              ))}
              <Summary k="Cumulative avg" v={fmt(transcript.cumulativeAverage, 2)} strong />
              <Summary k="GPA (4.0)" v={fmt(transcript.gpa, 2)} strong />
              <Summary k="Rank" v={rank?.rank ? `${rank.rank} / ${rank.of}` : "—"} strong />
              <Summary k="Years" v={`${transcript.yearsCompleted} / 4`} />
            </section>
            <p className="mt-1.5 text-[10.5px]">
              <span className="font-semibold text-paper-accent">Remark: </span>
              {transcript.yearsCompleted < 4 ? `Record in progress (${transcript.yearsCompleted} of 4 years complete)` : graduationRemark(transcript.cumulativeAverage, passMark)}
            </p>

            <p className="mt-1 text-[8px] leading-snug text-paper-muted">
              Grading scale: {GRADE_SCALE.map((g, i) => `${g.letter} ${g.min}${i === 0 ? "–100" : `–${GRADE_SCALE[i - 1]!.min - 1}`}`).join(" · ")}. Pass mark {passMark}.
              Annual average = mean of Semester I & II averages; cumulative average = mean of the annual averages.
            </p>

            <section className="mt-3 grid grid-cols-3 items-end gap-8 break-inside-avoid">
              <SignatureBox label="Registrar" name={settings?.registrar_name} />
              <div className="flex flex-col items-center">
                <div className="flex h-[22mm] w-[22mm] items-center justify-center rounded-full border-2 border-dashed border-paper-border text-[8px] uppercase tracking-wider text-paper-muted">
                  Official stamp
                </div>
              </div>
              <SignatureBox label="Principal" name={settings?.principal_name} />
            </section>

            <footer className="mt-3 flex justify-between border-t border-paper-border pt-1.5 text-[8px] text-paper-muted">
              <span>Transcript no. {transcriptNo}</span>
              <span>Issued {issued.toLocaleDateString()} · Not valid without the school stamp and signatures</span>
            </footer>
          </div>
        </article>
      </div>
    </div>
  );
}

function Info({ k, v, mono, wide }: { k: string; v: string; mono?: boolean; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2" : ""}>
      <dt className="text-[8px] uppercase tracking-wider text-paper-muted">{k}</dt>
      <dd className={`font-semibold ${wide ? "font-display text-[14px]" : ""} ${mono ? "font-mono" : ""}`}>{v}</dd>
    </div>
  );
}

function Summary({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className={`border-r border-paper-border px-1 py-1 last:border-r-0 ${strong ? "bg-paper-tint" : ""}`}>
      <p className="text-[7.5px] uppercase tracking-wider text-paper-muted">{k}</p>
      <p className={`tabular ${strong ? "font-bold text-paper-accent" : "font-semibold"}`}>{v}</p>
    </div>
  );
}
