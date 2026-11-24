import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { FileSpreadsheet, Loader2, Lock, Save, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { myClassesQuery, settingsQuery, studentsQuery, subjectsQuery, submissionsQuery, useClassMarks } from "@/lib/queries";
import { useStaff } from "@/hooks/use-staff";
import { chunk, classLabel, defaultStream, subjectsFor } from "@/lib/school";
import { mean, rankBy, sum } from "@/lib/grading";
import { downloadWorkbook, pick, readSpreadsheet } from "@/lib/excel";
import { fmt } from "@/lib/results";
import { PageHeader } from "@/components/app/PageHeader";
import { ClassPicker, Pick, inClass, type ClassSelection } from "@/components/app/ClassPicker";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/marks")({
  head: () => ({
    meta: [
      { title: "Marks Entry — Burka Harbu SSS" },
      { name: "description", content: "Enter Semester 1 and 2 marks for each class." },
      { property: "og:title", content: "Marks Entry — Burka Harbu SSS" },
      { property: "og:description", content: "Enter Semester 1 and 2 marks for each class." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MarksPage,
});

const key = (studentId: string, subjectId: string) => `${studentId}:${subjectId}`;

function MarksPage() {
  const qc = useQueryClient();
  const { data: students = [] } = useQuery(studentsQuery);
  const { data: subjects = [] } = useQuery(subjectsQuery);
  const { data: settings } = useQuery(settingsQuery);
  const [sel, setSel] = useState<ClassSelection>({ grade: 9, section: "A", stream: null });
  const [semester, setSemester] = useState<1 | 2>(1);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const { data: me } = useStaff();
  const teacherOnly = !!me?.teacherOnly;
  const { data: myClasses } = useQuery({ ...myClassesQuery, enabled: teacherOnly });
  const { data: submissions = [] } = useQuery(submissionsQuery(settings?.current_academic_year ?? ""));
  const submission = submissions.find((x) => x.grade === sel.grade && x.section === sel.section && x.semester === semester);
  const locked = teacherOnly && (submission?.status === "submitted" || submission?.status === "approved");

  useEffect(() => {
    const first = myClasses?.[0];
    if (teacherOnly && first && !myClasses.some((c) => c.grade === sel.grade && c.section === sel.section)) {
      setSel({ grade: first.grade, section: first.section, stream: defaultStream(first.grade, first.section) });
    }
  }, [teacherOnly, myClasses, sel.grade, sel.section]);

  const sections = useMemo(
    () => [...new Set(students.filter((s) => s.grade === sel.grade).map((s) => s.section))].sort(),
    [students, sel.grade],
  );
  const classStudents = useMemo(
    () => students.filter((s) => inClass(s, sel)).sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [students, sel],
  );
  const classSubjects = useMemo(() => subjectsFor(subjects, sel.grade, sel.stream), [subjects, sel]);
  const ids = useMemo(() => classStudents.map((s) => s.id), [classStudents]);
  const marksQ = useClassMarks(ids, sel.grade);

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const m of marksQ.data ?? []) {
      if (m.semester === semester) next[key(m.student_id, m.subject_id)] = String(Number(m.score));
    }
    setDraft(next);
    setDirty(new Set());
  }, [marksQ.data, semester]);

  function setCell(k: string, v: string) {
    if (v !== "" && !/^\d{0,3}(\.\d{0,2})?$/.test(v)) return;
    setDraft((d) => ({ ...d, [k]: v }));
    setDirty((d) => new Set(d).add(k));
  }

  const value = (k: string) => {
    const v = draft[k];
    if (v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
  };

  const invalid = (k: string) => {
    const n = value(k);
    return n !== null && (n < 0 || n > 100);
  };

  const rowStats = classStudents.map((s) => {
    const vals = classSubjects.map((sub) => value(key(s.id, sub.id)));
    return { s, total: sum(vals), average: mean(vals) };
  });
  const ranks = rankBy(rowStats, (r) => r.average);

  async function save() {
    const bad = [...dirty].filter(invalid);
    if (bad.length) return void toast.error("Some marks are outside 0–100. Fix the red cells first.");
    setSaving(true);
    try {
      const upserts: { student_id: string; subject_id: string; grade: number; semester: number; score: number; academic_year: string }[] = [];
      const deletes: { student_id: string; subject_id: string }[] = [];
      for (const k of dirty) {
        const [student_id, subject_id] = k.split(":") as [string, string];
        const v = value(k);
        if (v === null) deletes.push({ student_id, subject_id });
        else upserts.push({ student_id, subject_id, grade: sel.grade, semester, score: v, academic_year: settings?.current_academic_year ?? "" });
      }
      for (const batch of chunk(upserts, 500)) {
        const { error } = await supabase.from("marks").upsert(batch, { onConflict: "student_id,subject_id,grade,semester" });
        if (error) throw error;
      }
      for (const d of deletes) {
        const { error } = await supabase.from("marks").delete()
          .eq("student_id", d.student_id).eq("subject_id", d.subject_id).eq("grade", sel.grade).eq("semester", semester);
        if (error) throw error;
      }
      await qc.invalidateQueries({ queryKey: ["marks"] });
      toast.success(`Saved ${upserts.length + deletes.length} marks`);
    } catch (e) {
      toast.error((e as { message?: string }).message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (dirty.size) void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>, r: number, c: number) {
    const move = (dr: number, dc: number) => {
      const el = document.querySelector<HTMLInputElement>(`[data-cell="${r + dr}-${c + dc}"]`);
      if (el) {
        e.preventDefault();
        el.focus();
        el.select();
      }
    };
    if (e.key === "Enter" || e.key === "ArrowDown") move(1, 0);
    else if (e.key === "ArrowUp") move(-1, 0);
    else if (e.key === "ArrowRight" && e.currentTarget.selectionStart === e.currentTarget.value.length) move(0, 1);
    else if (e.key === "ArrowLeft" && e.currentTarget.selectionStart === 0) move(0, -1);
  }

  function template() {
    downloadWorkbook(`marks-G${sel.grade}${sel.section}-S${semester}.xlsx`, [
      {
        name: `G${sel.grade}${sel.section} Sem ${semester}`,
        rows: [
          ["Student Code", "Full Name", ...classSubjects.map((s) => s.name)],
          ...classStudents.map((s) => [
            s.student_code,
            s.full_name,
            ...classSubjects.map((sub) => value(key(s.id, sub.id))),
          ]),
        ],
        widths: [14, 30, ...classSubjects.map(() => 12)],
      },
    ]);
  }

  async function importSheet(file: File) {
    try {
      const rows = await readSpreadsheet(file);
      const byCode = new Map(classStudents.map((s) => [s.student_code.toLowerCase(), s]));
      let count = 0;
      let unknown = 0;
      const nextDraft = { ...draft };
      const nextDirty = new Set(dirty);
      for (const r of rows) {
        const code = String(pick(r, "Student Code", "Code", "ID") ?? "").trim().toLowerCase();
        const st = byCode.get(code);
        if (!st) {
          if (code) unknown++;
          continue;
        }
        for (const sub of classSubjects) {
          const v = pick(r, sub.name, sub.code);
          if (v === null) continue;
          const n = Number(v);
          if (Number.isNaN(n) || n < 0 || n > 100) continue;
          nextDraft[key(st.id, sub.id)] = String(n);
          nextDirty.add(key(st.id, sub.id));
          count++;
        }
      }
      setDraft(nextDraft);
      setDirty(nextDirty);
      toast.success(`${count} marks loaded — review and press Save`, {
        description: unknown ? `${unknown} rows had codes not in this class` : undefined,
      });
    } catch {
      toast.error("Could not read that file");
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Marks & grades"
        title="Marks entry"
        description="Type marks out of 100. Enter or ↓ moves down, ← → move across. Press Ctrl+S to save."
        actions={
          <>
            <Button variant="outline" onClick={template} disabled={!classStudents.length}><FileSpreadsheet /> Mark sheet</Button>
            <input ref={fileInput} type="file" accept=".xlsx,.xls,.csv" className="hidden" aria-label="Marks spreadsheet" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importSheet(f); e.target.value = ""; }} />
            <Button variant="outline" onClick={() => fileInput.current?.click()} disabled={locked || !classStudents.length}>
              <Upload /> Import Excel
            </Button>
            <Button onClick={save} disabled={saving || locked || dirty.size === 0}>
              {saving ? <Loader2 className="animate-spin" /> : <Save />} Save{dirty.size ? ` (${dirty.size})` : ""}
            </Button>
          </>
        }
      />

      <ClassPicker value={sel} onChange={(v) => { if (dirty.size && !confirm("Discard unsaved marks?")) return; setSel(v); }} sections={sections} classes={teacherOnly ? (myClasses ?? []) : undefined}>
        <Pick label="Semester">
          <Select value={String(semester)} onValueChange={(v) => { if (dirty.size && !confirm("Discard unsaved marks?")) return; setSemester(Number(v) as 1 | 2); }}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Semester 1</SelectItem>
              <SelectItem value="2">Semester 2</SelectItem>
            </SelectContent>
          </Select>
        </Pick>
        <p className="ml-auto self-center text-sm text-muted-foreground">
          {classLabel(sel.grade, sel.section, sel.stream)} · {classStudents.length} students
        </p>
      </ClassPicker>

      {teacherOnly && myClasses?.length === 0 && (
        <p className="mt-4 rounded-2xl border border-gold/40 bg-gold/10 p-4 text-sm text-gold">No class is assigned to you yet. Ask the admin to assign your class.</p>
      )}
      {locked && (
        <p className="mt-4 flex items-center gap-2 rounded-2xl border border-azure/40 bg-azure-soft p-4 text-sm">
          <Lock className="h-4 w-4 text-azure" />
          Semester {semester} was {submission?.status === "approved" ? "approved by the admin" : "sent to the admin"} — marks are locked.
          {submission?.status === "submitted" && " If the admin returns it, you can edit again."}
        </p>
      )}
      <div className="glass mt-4 overflow-hidden rounded-2xl">
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="glass-strong text-xs text-muted-foreground">
                <th className="sticky left-0 z-20 min-w-[60px] bg-popover px-3 py-3 text-left">#</th>
                <th className="sticky left-[60px] z-20 min-w-[220px] bg-popover px-3 py-3 text-left">Student</th>
                {classSubjects.map((s) => (
                  <th key={s.id} className="min-w-[78px] bg-popover px-1 py-3 text-center font-medium" title={s.name}>
                    {s.code}
                  </th>
                ))}
                <th className="bg-popover px-3 py-3 text-right text-gold">Total</th>
                <th className="bg-popover px-3 py-3 text-right text-gold">Avg</th>
                <th className="bg-popover px-3 py-3 text-right text-gold">Rank</th>
              </tr>
            </thead>
            <tbody>
              {marksQ.isLoading && ids.length > 0 && (
                <tr><td colSpan={classSubjects.length + 5} className="p-10 text-center text-muted-foreground">Loading marks…</td></tr>
              )}
              {classStudents.length === 0 && (
                <tr><td colSpan={classSubjects.length + 5} className="p-14 text-center text-muted-foreground">No students in this class yet.</td></tr>
              )}
              {rowStats.map(({ s, total, average }, r) => (
                <tr key={s.id} className="group">
                  <td className="sticky left-0 border-b border-glass-border bg-background/95 px-3 py-1 text-xs text-muted-foreground">{r + 1}</td>
                  <td className="sticky left-[60px] border-b border-glass-border bg-background/95 px-3 py-1">
                    <p className="truncate font-medium">{s.full_name}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">{s.student_code}</p>
                  </td>
                  {classSubjects.map((sub, c) => {
                    const k = key(s.id, sub.id);
                    return (
                      <td key={sub.id} className="border-b border-glass-border p-0.5">
                        <input
                          data-cell={`${r}-${c}`}
                          inputMode="decimal"
                          value={draft[k] ?? ""}
                          onChange={(e) => setCell(k, e.target.value)}
                          onKeyDown={(e) => onKeyDown(e, r, c)}
                          onFocus={(e) => e.currentTarget.select()}
                          readOnly={locked}
                          aria-label={`${s.full_name} ${sub.name}`}
                          className={cn(
                            "h-9 w-full rounded-md border bg-transparent text-center font-mono text-sm tabular outline-none transition focus:bg-primary/10 focus:ring-1 focus:ring-primary",
                            invalid(k) ? "border-destructive text-destructive" : dirty.has(k) ? "border-gold/60 text-gold" : "border-transparent",
                            value(k) !== null && value(k)! < (settings?.pass_mark ?? 50) && !invalid(k) && "text-destructive",
                          )}
                        />
                      </td>
                    );
                  })}
                  <td className="border-b border-glass-border px-3 text-right font-mono tabular">{fmt(total)}</td>
                  <td className={cn("border-b border-glass-border px-3 text-right font-mono tabular", average !== null && average < (settings?.pass_mark ?? 50) ? "text-destructive" : "text-primary")}>{fmt(average, 2)}</td>
                  <td className="border-b border-glass-border px-3 text-right font-mono tabular">{ranks.get(rowStats[r]!) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {dirty.size > 0 && (
        <p className="mt-3 text-sm text-gold">{dirty.size} unsaved change{dirty.size === 1 ? "" : "s"} — gold cells are not saved yet.</p>
      )}
    </div>
  );
}
