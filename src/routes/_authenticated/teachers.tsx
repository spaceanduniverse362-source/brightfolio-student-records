import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { FileDown, KeyRound, Loader2, Plus, Trash2, UserPlus, UserX, Users, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { studentsQuery } from "@/lib/queries";
import { makeUsername, randomPassword } from "@/lib/login";
import { downloadWorkbook } from "@/lib/excel";
import { createTeacherLogin, removeTeacherLogin, resetTeacherPassword } from "@/lib/teachers.functions";
import { PageHeader, GlassCard } from "@/components/app/PageHeader";
import { RequireRole } from "@/components/app/RequireRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/teachers")({
  head: () => ({
    meta: [
      { title: "Teachers — Burka Harbu SSS" },
      { name: "description", content: "Teacher logins and class assignments." },
      { property: "og:title", content: "Teachers — Burka Harbu SSS" },
      { property: "og:description", content: "Teacher logins and class assignments." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireRole role="admin">
      <TeachersPage />
    </RequireRole>
  ),
});

type Credential = { name: string; username: string; password: string };

const teachersQuery = {
  queryKey: ["teachers"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("teachers")
      .select("*, teacher_classes(id, grade, section)")
      .order("full_name");
    if (error) throw error;
    return data ?? [];
  },
};

function TeachersPage() {
  const qc = useQueryClient();
  const { data: teachers = [], isLoading } = useQuery(teachersQuery);
  const { data: students = [] } = useQuery(studentsQuery);
  const create = useServerFn(createTeacherLogin);
  const reset = useServerFn(resetTeacherPassword);
  const removeLogin = useServerFn(removeTeacherLogin);
  const [newName, setNewName] = useState("");
  const [creds, setCreds] = useState<Credential[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [loginFor, setLoginFor] = useState<{ id: string; name: string; username: string; password: string } | null>(null);

  const classes = useMemo(() => {
    const set = new Map<string, { grade: number; section: string }>();
    for (const s of students) if (s.status === "active") set.set(`${s.grade}|${s.section}`, { grade: s.grade, section: s.section });
    return [...set.values()].sort((a, b) => a.grade - b.grade || a.section.localeCompare(b.section));
  }, [students]);
  const taken = () => new Set(teachers.map((t) => t.username).filter((u): u is string => !!u));
  const refresh = () => qc.invalidateQueries({ queryKey: ["teachers"] });

  async function addTeacher() {
    const name = newName.trim();
    if (!name) return;
    const { error } = await supabase.from("teachers").insert({ full_name: name.slice(0, 120) });
    if (error) return void toast.error(error.message);
    setNewName("");
    refresh();
  }

  async function doCreate(id: string, name: string, username: string, password: string) {
    const res = await create({ data: { teacherId: id, username, password } });
    if (!res.ok) throw new Error(`${name}: ${res.error}`);
    return { name, username, password };
  }

  async function createAll() {
    const todo = teachers.filter((t) => !t.user_id);
    if (!todo.length) return;
    setBusy("all");
    const used = taken();
    const done: Credential[] = [];
    try {
      for (const t of todo) done.push(await doCreate(t.id, t.full_name, makeUsername(t.full_name, used), randomPassword()));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
      refresh();
      if (done.length) setCreds(done);
    }
  }

  async function resetPassword(id: string, name: string, username: string) {
    setBusy(id);
    const password = randomPassword();
    const res = await reset({ data: { teacherId: id, password } });
    setBusy(null);
    if (!res.ok) return void toast.error(res.error);
    setCreds([{ name, username, password }]);
  }

  async function revoke(id: string) {
    if (!confirm("Remove this teacher's login? They will no longer be able to sign in.")) return;
    setBusy(id);
    const res = await removeLogin({ data: { teacherId: id } });
    setBusy(null);
    if (!res.ok) return void toast.error(res.error);
    refresh();
    toast.success("Login removed");
  }

  async function deleteTeacher(id: string, hasLogin: boolean) {
    if (!confirm("Delete this teacher from the list?")) return;
    if (hasLogin) {
      const res = await removeLogin({ data: { teacherId: id } });
      if (!res.ok) return void toast.error(res.error);
    }
    const { error } = await supabase.from("teachers").delete().eq("id", id);
    if (error) return void toast.error(error.message);
    refresh();
  }

  async function assign(teacherId: string, value: string) {
    const [g, section] = value.split("|") as [string, string];
    const { error } = await supabase.from("teacher_classes").insert({ teacher_id: teacherId, grade: Number(g), section });
    if (error) return void toast.error(error.code === "23505" ? "Already assigned" : error.message);
    refresh();
  }

  async function unassign(id: string) {
    const { error } = await supabase.from("teacher_classes").delete().eq("id", id);
    if (error) return void toast.error(error.message);
    refresh();
  }

  const withLogin = teachers.filter((t) => t.user_id).length;

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Teachers"
        description="Give each teacher a login and assign the classes they send results for."
        actions={
          <Button onClick={createAll} disabled={busy !== null || withLogin === teachers.length}>
            {busy === "all" ? <Loader2 className="animate-spin" /> : <KeyRound />} Create logins for all ({teachers.length - withLogin})
          </Button>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <GlassCard className="p-5"><p className="text-xs uppercase tracking-wider text-muted-foreground">Teachers</p><p className="font-display text-3xl font-semibold">{teachers.length}</p></GlassCard>
        <GlassCard className="p-5"><p className="text-xs uppercase tracking-wider text-muted-foreground">With login</p><p className="font-display text-3xl font-semibold text-azure">{withLogin}</p></GlassCard>
        <GlassCard className="flex items-end gap-2 p-5">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="new-teacher" className="text-xs text-muted-foreground">Add a teacher</Label>
            <Input id="new-teacher" placeholder="Full name" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTeacher()} />
          </div>
          <Button size="icon" onClick={addTeacher} aria-label="Add teacher"><Plus /></Button>
        </GlassCard>
      </div>

      <GlassCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gradient-azure text-left text-xs uppercase tracking-wider text-azure-foreground">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Teacher</th>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Classes</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={5} className="p-10 text-center text-muted-foreground">Loading…</td></tr>}
              {teachers.map((t, i) => (
                <tr key={t.id} className="border-b border-glass-border/60 align-top hover:bg-muted/20">
                  <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-3 font-medium">{t.full_name}</td>
                  <td className="px-4 py-3">
                    {t.username ? <span className="font-mono text-xs text-azure">{t.username}</span> : <span className="text-xs text-muted-foreground">No login</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {t.teacher_classes.map((c) => (
                        <span key={c.id} className="inline-flex items-center gap-1 rounded-full border border-azure/40 bg-azure-soft px-2.5 py-0.5 text-xs font-medium">
                          {c.grade}{c.section}
                          <button onClick={() => unassign(c.id)} aria-label={`Remove ${c.grade}${c.section}`} className="text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
                        </span>
                      ))}
                      <Select value="" onValueChange={(v) => assign(t.id, v)}>
                        <SelectTrigger className="h-7 w-28 text-xs" aria-label={`Assign class to ${t.full_name}`}><SelectValue placeholder="+ Class" /></SelectTrigger>
                        <SelectContent>
                          {classes.map((c) => <SelectItem key={`${c.grade}|${c.section}`} value={`${c.grade}|${c.section}`}>Grade {c.grade}{c.section}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {t.user_id ? (
                        <>
                          <Button variant="outline" size="sm" disabled={busy === t.id} onClick={() => resetPassword(t.id, t.full_name, t.username ?? "")}>
                            {busy === t.id ? <Loader2 className="animate-spin" /> : <KeyRound />} New password
                          </Button>
                          <Button variant="ghost" size="icon" aria-label="Remove login" onClick={() => revoke(t.id)}><UserX /></Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => setLoginFor({ id: t.id, name: t.full_name, username: makeUsername(t.full_name, taken()), password: randomPassword() })}
                        >
                          <UserPlus /> Create login
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" aria-label="Delete teacher" onClick={() => deleteTeacher(t.id, !!t.user_id)}><Trash2 /></Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && teachers.length === 0 && (
                <tr><td colSpan={5} className="p-12 text-center text-muted-foreground"><Users className="mx-auto mb-2 h-6 w-6" />No teachers yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <Dialog open={!!loginFor} onOpenChange={(o) => !o && setLoginFor(null)}>
        <DialogContent className="glass-strong">
          <DialogHeader>
            <DialogTitle>Create login</DialogTitle>
            <DialogDescription>{loginFor?.name} will sign in on the Teacher tab with this username and password.</DialogDescription>
          </DialogHeader>
          {loginFor && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="t-user">Username</Label>
                <Input id="t-user" value={loginFor.username} onChange={(e) => setLoginFor({ ...loginFor, username: e.target.value.toLowerCase().replace(/\s/g, "") })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="t-pass">Password</Label>
                <Input id="t-pass" value={loginFor.password} onChange={(e) => setLoginFor({ ...loginFor, password: e.target.value })} className="font-mono" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              disabled={busy !== null}
              onClick={async () => {
                if (!loginFor) return;
                setBusy(loginFor.id);
                try {
                  const c = await doCreate(loginFor.id, loginFor.name, loginFor.username.trim(), loginFor.password);
                  setLoginFor(null);
                  setCreds([c]);
                  refresh();
                } catch (e) {
                  toast.error((e as Error).message);
                } finally {
                  setBusy(null);
                }
              }}
            >
              {busy && <Loader2 className="animate-spin" />} Create login
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!creds} onOpenChange={(o) => !o && setCreds(null)}>
        <DialogContent className="glass-strong sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Teacher logins ready</DialogTitle>
            <DialogDescription>Write these down or download them now — passwords are not shown again.</DialogDescription>
          </DialogHeader>
          <div className="max-h-72 overflow-auto rounded-xl border border-glass-border text-sm">
            <table className="w-full">
              <thead className="sticky top-0 bg-muted text-left text-xs"><tr><th className="px-3 py-2">Teacher</th><th className="px-3 py-2">Username</th><th className="px-3 py-2">Password</th></tr></thead>
              <tbody>
                {creds?.map((c) => (
                  <tr key={c.username} className="border-t border-glass-border">
                    <td className="px-3 py-1.5">{c.name}</td>
                    <td className="px-3 py-1.5 font-mono text-azure">{c.username}</td>
                    <td className="px-3 py-1.5 font-mono">{c.password}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DialogFooter>
            <Button
              variant="gold"
              onClick={() =>
                creds &&
                downloadWorkbook(`teacher-logins-${new Date().toISOString().slice(0, 10)}.xlsx`, [
                  { name: "Teacher logins", rows: [["Teacher", "Username", "Password"], ...creds.map((c) => [c.name, c.username, c.password])], widths: [32, 24, 16] },
                ])
              }
            >
              <FileDown /> Download Excel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
