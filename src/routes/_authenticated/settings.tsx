import { createFileRoute } from "@tanstack/react-router";
import { displayLogin } from "@/lib/login";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { DatabaseBackup, FileJson, FileSpreadsheet, Loader2, Plus, Save, ShieldCheck, Trash2, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useStaff } from "@/hooks/use-staff";
import { settingsQuery, subjectsQuery } from "@/lib/queries";
import { GRADES, fetchAll, type Mark, type Student, type Subject } from "@/lib/school";
import { downloadText, downloadWorkbook } from "@/lib/excel";
import { PageHeader, GlassCard } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings & Backup — Burka Harbu SSS" },
      { name: "description", content: "School details, subjects, staff access and data backups." },
      { property: "og:title", content: "Settings & Backup — Burka Harbu SSS" },
      { property: "og:description", content: "School details, subjects, staff access and data backups." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { data: staff } = useStaff();
  return (
    <div>
      <PageHeader eyebrow="Administration" title="Settings & backup" description="School details, subjects, staff access and full data backups." />
      <Tabs defaultValue="backup">
        <TabsList className="glass mb-4 h-auto flex-wrap">
          <TabsTrigger value="backup">Backup & export</TabsTrigger>
          <TabsTrigger value="school">School details</TabsTrigger>
          <TabsTrigger value="subjects">Subjects</TabsTrigger>
          <TabsTrigger value="staff">Staff access</TabsTrigger>
        </TabsList>
        <TabsContent value="backup"><Backup /></TabsContent>
        <TabsContent value="school"><SchoolDetails canEdit={!!staff?.isAdmin} /></TabsContent>
        <TabsContent value="subjects"><Subjects canEdit={!!staff?.isAdmin} /></TabsContent>
        <TabsContent value="staff"><Staff isAdmin={!!staff?.isAdmin} me={staff?.userId ?? ""} /></TabsContent>
      </Tabs>
    </div>
  );
}

async function loadEverything() {
  const [students, marks, subjects, settings] = await Promise.all([
    fetchAll<Student>((f, t) => supabase.from("students").select("*").order("student_code").range(f, t)),
    fetchAll<Mark>((f, t) => supabase.from("marks").select("*").order("id").range(f, t)),
    supabase.from("subjects").select("*").order("sort_order").then((r) => r.data ?? []),
    supabase.from("school_settings").select("*").eq("id", 1).maybeSingle().then((r) => r.data),
  ]);
  return { students, marks, subjects, settings };
}

function Backup() {
  const [busy, setBusy] = useState<"json" | "xlsx" | null>(null);
  const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");

  async function json() {
    setBusy("json");
    try {
      const data = await loadEverything();
      downloadText(`burka-harbu-backup-${stamp()}.json`, JSON.stringify({ exported_at: new Date().toISOString(), ...data }, null, 2));
      toast.success(`Backup ready: ${data.students.length} students, ${data.marks.length} marks`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function xlsx() {
    setBusy("xlsx");
    try {
      const { students, marks, subjects } = await loadEverything();
      const code = new Map(students.map((s) => [s.id, s]));
      const sub = new Map(subjects.map((s) => [s.id, s]));
      await downloadWorkbook(`burka-harbu-backup-${stamp()}.xlsx`, [
        {
          name: "Students",
          rows: [
            ["Student Code", "Full Name", "Gender", "Date of Birth", "Admission Number", "Admission Date", "Grade", "Section", "Stream", "Academic Year", "Status"],
            ...students.map((s) => [s.student_code, s.full_name, s.gender, s.date_of_birth, s.admission_number, s.admission_date, s.grade, s.section, s.stream, s.academic_year, s.status]),
          ],
          widths: [14, 30, 8, 12, 16, 12, 6, 8, 10, 12, 11],
        },
        {
          name: "Marks",
          rows: [
            ["Student Code", "Full Name", "Grade", "Semester", "Subject Code", "Subject", "Score", "Academic Year"],
            ...marks.map((m) => [code.get(m.student_id)?.student_code ?? "", code.get(m.student_id)?.full_name ?? "", m.grade, m.semester, sub.get(m.subject_id)?.code ?? "", sub.get(m.subject_id)?.name ?? "", Number(m.score), m.academic_year]),
          ],
          widths: [14, 30, 6, 9, 10, 26, 7, 12],
        },
        {
          name: "Subjects",
          rows: [["Code", "Name", "Grades", "Streams"], ...subjects.map((s) => [s.code, s.name, s.grades.join(","), s.streams.join(",") || "all"])],
        },
      ]);
      toast.success("Excel backup downloaded");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <GlassCard className="p-6">
        <FileJson className="h-7 w-7 text-primary" />
        <h3 className="mt-3 text-xl font-semibold">Full JSON backup</h3>
        <p className="mt-1 text-sm text-muted-foreground">Every student, mark, subject and setting in one file. Best for safekeeping.</p>
        <Button className="mt-5" onClick={json} disabled={!!busy}>{busy === "json" ? <Loader2 className="animate-spin" /> : <DatabaseBackup />} Download JSON</Button>
      </GlassCard>
      <GlassCard className="p-6">
        <FileSpreadsheet className="h-7 w-7 text-gold" />
        <h3 className="mt-3 text-xl font-semibold">Excel workbook</h3>
        <p className="mt-1 text-sm text-muted-foreground">Students, marks and subjects on separate sheets — easy to open and review.</p>
        <Button variant="gold" className="mt-5" onClick={xlsx} disabled={!!busy}>{busy === "xlsx" ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />} Download Excel</Button>
      </GlassCard>
    </div>
  );
}

function SchoolDetails({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const { data } = useQuery(settingsQuery);
  const [form, setForm] = useState({ school_name: "", school_name_local: "", principal_name: "", registrar_name: "", current_academic_year: "", pass_mark: "50" });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (data) setForm({ school_name: data.school_name, school_name_local: data.school_name_local, principal_name: data.principal_name, registrar_name: data.registrar_name, current_academic_year: data.current_academic_year, pass_mark: String(data.pass_mark) });
  }, [data]);
  async function save() {
    const pm = Number(form.pass_mark);
    if (Number.isNaN(pm) || pm < 0 || pm > 100) return void toast.error("Pass mark must be 0–100");
    if (!form.school_name.trim() || !form.current_academic_year.trim()) return void toast.error("School name and academic year are required");
    setBusy(true);
    const { error } = await supabase.from("school_settings").update({
      school_name: form.school_name.trim().slice(0, 120),
      school_name_local: form.school_name_local.trim().slice(0, 160),
      principal_name: form.principal_name.trim().slice(0, 100),
      registrar_name: form.registrar_name.trim().slice(0, 100),
      current_academic_year: form.current_academic_year.trim().slice(0, 20),
      pass_mark: pm,
    }).eq("id", 1);
    setBusy(false);
    if (error) return void toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["settings"] });
    toast.success("School details saved");
  }
  const f = (k: keyof typeof form, label: string) => (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input value={form[k]} disabled={!canEdit} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
    </div>
  );
  return (
    <GlassCard className="max-w-3xl p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {f("school_name", "School name")}
        {f("school_name_local", "School name (Afan Oromo)")}
        {f("principal_name", "Principal (printed on documents)")}
        {f("registrar_name", "Registrar (printed on documents)")}
        {f("current_academic_year", "Current academic year")}
        {f("pass_mark", "Pass mark (average out of 100)")}
      </div>
      {canEdit ? (
        <Button className="mt-6" onClick={save} disabled={busy}><Save /> Save details</Button>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">Only admins can change school details.</p>
      )}
    </GlassCard>
  );
}

function Subjects({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const { data: subjects = [] } = useQuery(subjectsQuery);
  const [draft, setDraft] = useState({ code: "", name: "" });

  async function update(s: Subject, patch: Partial<Subject>) {
    const { error } = await supabase.from("subjects").update(patch).eq("id", s.id);
    if (error) return void toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["subjects"] });
  }
  async function add() {
    const code = draft.code.trim().toUpperCase().slice(0, 10);
    const name = draft.name.trim().slice(0, 60);
    if (!code || !name) return void toast.error("Enter a code and a name");
    const { error } = await supabase.from("subjects").insert({ code, name, sort_order: subjects.length + 1 });
    if (error) return void toast.error(error.message.includes("duplicate") ? "That code already exists" : error.message);
    setDraft({ code: "", name: "" });
    qc.invalidateQueries({ queryKey: ["subjects"] });
  }
  async function remove(s: Subject) {
    if (!confirm(`Delete ${s.name}? All marks for this subject will be deleted too.`)) return;
    const { error } = await supabase.from("subjects").delete().eq("id", s.id);
    if (error) return void toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["subjects"] });
  }
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  return (
    <GlassCard className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-glass-border">
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Subject</th>
              {GRADES.map((g) => <th key={g} className="px-2 py-3 text-center">G{g}</th>)}
              <th className="px-2 py-3 text-center">Natural</th>
              <th className="px-2 py-3 text-center">Social</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {subjects.map((s) => (
              <tr key={s.id} className="border-b border-glass-border/60">
                <td className="px-4 py-2 font-mono text-xs">{s.code}</td>
                <td className="px-4 py-2">{s.name}</td>
                {GRADES.map((g) => (
                  <td key={g} className="px-2 py-2 text-center">
                    <Checkbox disabled={!canEdit} checked={s.grades.includes(g)} onCheckedChange={() => update(s, { grades: toggle(s.grades, g).sort() })} aria-label={`${s.name} grade ${g}`} />
                  </td>
                ))}
                {(["natural", "social"] as const).map((st) => (
                  <td key={st} className="px-2 py-2 text-center">
                    <Checkbox
                      disabled={!canEdit}
                      checked={s.streams.length === 0 || s.streams.includes(st)}
                      onCheckedChange={() => {
                        const cur = s.streams.length === 0 ? ["natural", "social"] : s.streams;
                        const next = toggle(cur, st);
                        update(s, { streams: next.length === 2 ? [] : next });
                      }}
                      aria-label={`${s.name} ${st} stream`}
                    />
                  </td>
                ))}
                <td className="px-4 py-2 text-right">
                  {canEdit && <Button variant="ghost" size="icon" onClick={() => remove(s)} aria-label="Delete subject"><Trash2 className="text-destructive" /></Button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canEdit && (
        <div className="flex flex-wrap items-end gap-3 p-4">
          <Input placeholder="Code (e.g. AGR)" value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} className="w-36" />
          <Input placeholder="Subject name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="w-64" />
          <Button variant="outline" onClick={add}><Plus /> Add subject</Button>
          <p className="text-xs text-muted-foreground">Stream ticks apply to Grades 11–12 only.</p>
        </div>
      )}
    </GlassCard>
  );
}

function Staff({ isAdmin, me }: { isAdmin: boolean; me: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["staff-list"],
    enabled: isAdmin,
    queryFn: async () => {
      const [{ data: profiles, error: e1 }, { data: roles, error: e2 }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at"),
        supabase.from("user_roles").select("*"),
      ]);
      if (e1 || e2) throw e1 ?? e2;
      return (profiles ?? []).map((p) => ({ ...p, roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role) }));
    },
  });

  async function grant(userId: string, role: "admin" | "registrar") {
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
    if (error) return void toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["staff-list"] });
    toast.success("Access granted");
  }
  async function revoke(userId: string) {
    const { error } = await supabase.from("user_roles").delete().eq("user_id", userId);
    if (error) return void toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["staff-list"] });
    toast.success("Access removed");
  }

  if (!isAdmin) return <GlassCard className="p-6 text-sm text-muted-foreground">Only admins can manage staff access.</GlassCard>;

  return (
    <GlassCard className="overflow-hidden">
      <p className="border-b border-glass-border p-4 text-sm text-muted-foreground">
        New staff create an account on the sign-in page, then appear here. Registrars manage students and marks; admins can also change settings, subjects and staff.
      </p>
      <table className="w-full text-sm">
        <tbody>
          {(data ?? []).map((p) => (
            <tr key={p.id} className="border-b border-glass-border/60">
              <td className="px-4 py-3">
                <p className="font-medium">{p.full_name || "—"}</p>
                <p className="text-xs text-muted-foreground">{displayLogin(p.email)}</p>
              </td>
              <td className="px-4 py-3">
                {p.roles.length ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs capitalize text-primary"><ShieldCheck className="h-3 w-3" /> {p.roles.join(", ")}</span>
                ) : (
                  <span className="rounded-full bg-gold/15 px-2 py-0.5 text-xs text-gold">Awaiting approval</span>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex justify-end gap-2">
                  {!p.roles.includes("registrar") && !p.roles.includes("admin") && (
                    <Button size="sm" variant="outline" onClick={() => grant(p.id, "registrar")}><UserCheck /> Registrar</Button>
                  )}
                  {!p.roles.includes("admin") && (
                    <Button size="sm" variant="outline" onClick={() => grant(p.id, "admin")}><ShieldCheck /> Admin</Button>
                  )}
                  {p.roles.length > 0 && p.id !== me && (
                    <Button size="sm" variant="ghost" onClick={() => revoke(p.id)}><UserX className="text-destructive" /> Remove</Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </GlassCard>
  );
}
