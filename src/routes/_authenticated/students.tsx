import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowUpCircle, FileDown, GraduationCap, Pencil, Search, Trash2, Upload, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { settingsQuery, studentsQuery } from "@/lib/queries";
import { GRADES, SECTIONS, chunk, genderLabel, streamLabel, type Student } from "@/lib/school";
import { downloadWorkbook } from "@/lib/excel";
import { PageHeader } from "@/components/app/PageHeader";
import { StudentDialog } from "@/components/app/StudentDialog";
import { ImportStudentsDialog } from "@/components/app/ImportStudentsDialog";
import { StudentPhoto } from "@/components/app/StudentPhoto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/students")({
  head: () => ({
    meta: [
      { title: "Students — Burka Harbu SSS" },
      { name: "description", content: "Student roster management for Grades 9–12." },
      { property: "og:title", content: "Students — Burka Harbu SSS" },
      { property: "og:description", content: "Student roster management for Grades 9–12." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StudentsPage,
});

const ALL = "all";

function StudentsPage() {
  const qc = useQueryClient();
  const { data: students = [], isLoading } = useQuery(studentsQuery);
  const { data: settings } = useQuery(settingsQuery);
  const year = settings?.current_academic_year ?? "";
  const [q, setQ] = useState("");
  const [grade, setGrade] = useState(ALL);
  const [section, setSection] = useState(ALL);
  const [stream, setStream] = useState(ALL);
  const [status, setStatus] = useState("active");
  const [editing, setEditing] = useState<Student | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [deleting, setDeleting] = useState<Student | null>(null);
  const [promoteOpen, setPromoteOpen] = useState(false);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return students.filter(
      (s) =>
        (grade === ALL || s.grade === Number(grade)) &&
        (section === ALL || s.section === section) &&
        (stream === ALL || s.stream === stream) &&
        (status === ALL || s.status === status) &&
        (!needle ||
          s.full_name.toLowerCase().includes(needle) ||
          s.student_code.toLowerCase().includes(needle) ||
          (s.admission_number ?? "").toLowerCase().includes(needle)),
    );
  }, [students, q, grade, section, stream, status]);

  async function remove(s: Student) {
    const { error } = await supabase.from("students").delete().eq("id", s.id);
    if (error) return void toast.error(error.message);
    if (s.photo_path) await supabase.storage.from("student-photos").remove([s.photo_path]);
    qc.invalidateQueries({ queryKey: ["students"] });
    toast.success("Student removed");
  }

  async function promote() {
    const targets = filtered.filter((s) => s.status === "active");
    try {
      for (const g of [12, 11, 10, 9]) {
        const ids = targets.filter((s) => s.grade === g).map((s) => s.id);
        for (const batch of chunk(ids, 200)) {
          const patch = g === 12 ? { status: "graduated" } : { grade: g + 1, academic_year: year };
          const { error } = await supabase.from("students").update(patch).in("id", batch);
          if (error) throw error;
        }
      }
      qc.invalidateQueries({ queryKey: ["students"] });
      toast.success(`${targets.length} students promoted`);
    } catch (e) {
      toast.error((e as { message?: string }).message ?? "Promotion failed");
    }
  }

  function exportList() {
    downloadWorkbook(`students-${new Date().toISOString().slice(0, 10)}.xlsx`, [
      {
        name: "Students",
        rows: [
          ["Student Code", "Full Name", "Gender", "Grade", "Section", "Stream", "Date of Birth", "Admission Number", "Academic Year", "Status"],
          ...filtered.map((s) => [
            s.student_code, s.full_name, s.gender, s.grade, s.section, s.stream ? streamLabel(s.stream) : "",
            s.date_of_birth ?? "", s.admission_number ?? "", s.academic_year, s.status,
          ]),
        ],
        widths: [14, 30, 8, 7, 8, 16, 14, 18, 14, 12],
      },
    ]);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Roster management"
        title="Students"
        description="Register, import and organise students by grade, section and stream."
        actions={
          <>
            <Button variant="outline" onClick={() => setPromoteOpen(true)} disabled={!filtered.some((s) => s.status === "active")}>
              <ArrowUpCircle /> Promote
            </Button>
            <Button variant="outline" onClick={exportList}><FileDown /> Export</Button>
            <Button variant="outline" onClick={() => setImportOpen(true)}><Upload /> Import</Button>
            <Button onClick={() => { setEditing(null); setDialogOpen(true); }}><UserPlus /> Register</Button>
          </>
        }
      />

      <div className="glass mb-4 flex flex-wrap items-center gap-3 rounded-2xl p-4">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by name, ID or admission no." value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <Filter value={grade} onChange={setGrade} placeholder="Grade" items={GRADES.map((g) => [String(g), `Grade ${g}`])} />
        <Filter value={section} onChange={setSection} placeholder="Section" items={SECTIONS.map((s) => [s, `Section ${s}`])} />
        <Filter value={stream} onChange={setStream} placeholder="Stream" items={[["natural", "Natural Science"], ["social", "Social Science"]]} />
        <Filter value={status} onChange={setStatus} placeholder="Status" items={[["active", "Active"], ["graduated", "Graduated"], ["transferred", "Transferred"]]} />
      </div>

      <div className="glass overflow-hidden rounded-2xl">
        <div className="flex items-center justify-between border-b border-glass-border px-4 py-3 text-sm">
          <span className="text-muted-foreground">
            <span className="font-semibold text-foreground">{filtered.length}</span> students
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr className="border-b border-glass-border">
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Sex</th>
                <th className="px-4 py-3">Class</th>
                <th className="px-4 py-3">Stream</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">Loading…</td></tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-14 text-center text-muted-foreground">
                    No students match. Register one or import your class lists.
                  </td>
                </tr>
              )}
              {filtered.slice(0, 500).map((s) => (
                <tr key={s.id} className="border-b border-glass-border/60 transition hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <StudentPhoto path={s.photo_path} name={s.full_name} className="h-9 w-9" />
                      <span className="font-medium">{s.full_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs">{s.student_code}</td>
                  <td className="px-4 py-2.5">{genderLabel(s.gender)}</td>
                  <td className="px-4 py-2.5">{s.grade}{s.section}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{s.grade >= 11 ? streamLabel(s.stream) : "—"}</td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${s.status === "active" ? "bg-primary/15 text-primary" : s.status === "graduated" ? "bg-gold/15 text-gold" : "bg-muted text-muted-foreground"}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" asChild aria-label="Transcript">
                        <Link to="/transcripts/$studentId" params={{ studentId: s.id }}><GraduationCap /></Link>
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => { setEditing(s); setDialogOpen(true); }}>
                        <Pencil />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => setDeleting(s)}>
                        <Trash2 className="text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > 500 && (
            <p className="p-3 text-center text-xs text-muted-foreground">Showing first 500 — narrow with filters or search.</p>
          )}
        </div>
      </div>

      <StudentDialog open={dialogOpen} onOpenChange={setDialogOpen} student={editing} academicYear={year} />
      <ImportStudentsDialog open={importOpen} onOpenChange={setImportOpen} academicYear={year} />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent className="glass-strong">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.full_name}?</AlertDialogTitle>
            <AlertDialogDescription>All marks for this student will also be deleted. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && remove(deleting)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={promoteOpen} onOpenChange={setPromoteOpen}>
        <AlertDialogContent className="glass-strong">
          <AlertDialogHeader>
            <AlertDialogTitle>Promote {filtered.filter((s) => s.status === "active").length} active students?</AlertDialogTitle>
            <AlertDialogDescription>
              Students in the current list move up one grade (academic year set to {year}). Grade 12 students are marked
              as graduated. Marks already recorded stay with their original grade. Grade 10 → 11 students keep no stream
              until you set one.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={promote}>Promote</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Filter({ value, onChange, placeholder, items }: { value: string; onChange: (v: string) => void; placeholder: string; items: string[][] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-40"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All {placeholder.toLowerCase()}s</SelectItem>
        {items.map(([v, l]) => <SelectItem key={v} value={v!}>{l}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
