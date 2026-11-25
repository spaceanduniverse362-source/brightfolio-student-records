import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Check, Send, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useStaff } from "@/hooks/use-staff";
import { myClassesQuery, settingsQuery, studentsQuery, submissionsQuery } from "@/lib/queries";
import { PageHeader, GlassCard } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/results")({
  head: () => ({
    meta: [
      { title: "Results Inbox — Burka Harbu SSS" },
      { name: "description", content: "Teachers send class results; the admin approves and publishes them to students." },
      { property: "og:title", content: "Results Inbox — Burka Harbu SSS" },
      { property: "og:description", content: "Send, approve and publish class results." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResultsPage,
});

const STATUS: Record<string, { label: string; cls: string }> = {
  none: { label: "Not sent", cls: "bg-muted text-muted-foreground" },
  submitted: { label: "Waiting for admin", cls: "bg-gold/15 text-gold" },
  approved: { label: "Published to students", cls: "bg-success/15 text-success" },
  returned: { label: "Returned", cls: "bg-destructive/15 text-destructive" },
};

function ResultsPage() {
  const qc = useQueryClient();
  const { data: me } = useStaff();
  const { data: settings } = useQuery(settingsQuery);
  const year = settings?.current_academic_year ?? "";
  const { data: subs = [] } = useQuery(submissionsQuery(year));
  const { data: students = [] } = useQuery(studentsQuery);
  const { data: mine = [] } = useQuery({ ...myClassesQuery, enabled: !!me?.teacherOnly });
  const [notes, setNotes] = useState<Record<string, string>>({});

  const classes = useMemo(() => {
    if (me?.teacherOnly) return mine;
    const m = new Map<string, { grade: number; section: string }>();
    for (const s of students) if (s.status === "active") m.set(`${s.grade}${s.section}`, { grade: s.grade, section: s.section });
    return [...m.values()].sort((a, b) => a.grade - b.grade || a.section.localeCompare(b.section));
  }, [me, mine, students]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["submissions"] });
  const find = (g: number, s: string, sem: number) => subs.find((x) => x.grade === g && x.section === s && x.semester === sem);

  async function send(g: number, s: string, sem: number) {
    const k = `${g}${s}${sem}`;
    const existing = find(g, s, sem);
    const row = { grade: g, section: s, semester: sem, academic_year: year, status: "submitted", note: notes[k] ?? "", submitted_by: me!.userId, submitted_at: new Date().toISOString() };
    const { error } = existing
      ? await supabase.from("result_submissions").update(row).eq("id", existing.id)
      : await supabase.from("result_submissions").insert(row);
    if (error) return void toast.error(error.message);
    toast.success("Sent to the admin");
    refresh();
  }

  async function review(g: number, s: string, sem: number, status: "approved" | "returned") {
    const k = `${g}${s}${sem}`;
    const existing = find(g, s, sem);
    const patch = { status, admin_note: notes[k] ?? "", reviewed_at: new Date().toISOString() };
    const { error } = existing
      ? await supabase.from("result_submissions").update(patch).eq("id", existing.id)
      : await supabase.from("result_submissions").insert({ ...patch, grade: g, section: s, semester: sem, academic_year: year, submitted_by: me!.userId });
    if (error) return void toast.error(error.message);
    toast.success(status === "approved" ? "Published — students can now see it" : "Returned to the teacher");
    refresh();
  }

  return (
    <div>
      <PageHeader
        eyebrow={`Academic year ${year}`}
        title={me?.teacherOnly ? "Send results" : "Results inbox"}
        description={me?.teacherOnly ? "When a semester's marks are complete, send them to the admin. Marks lock until the admin returns them." : "Approve a class to publish it to students, or return it to the teacher with a note."}
      />
      {classes.length === 0 && <GlassCard className="p-8 text-center text-muted-foreground">No classes yet.</GlassCard>}
      <div className="grid gap-4 lg:grid-cols-2">
        {classes.map((c) => (
          <GlassCard key={`${c.grade}${c.section}`} className="p-5">
            <p className="font-display text-2xl font-semibold">Grade {c.grade}<span className="text-azure">{c.section}</span></p>
            <div className="mt-3 space-y-3">
              {[1, 2].map((sem) => {
                const sub = find(c.grade, c.section, sem);
                const st = STATUS[sub?.status ?? "none"]!;
                const k = `${c.grade}${c.section}${sem}`;
                return (
                  <div key={sem} className="rounded-xl border-2 border-azure/30 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">Semester {sem}</span>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs ${st.cls}`}>{st.label}</span>
                    </div>
                    {sub?.note && <p className="mt-1 text-xs text-muted-foreground">Teacher: {sub.note}</p>}
                    {sub?.admin_note && <p className="mt-1 text-xs text-gold">Admin: {sub.admin_note}</p>}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Input className="h-8 flex-1 text-xs" placeholder="Note (optional)" value={notes[k] ?? ""} onChange={(e) => setNotes({ ...notes, [k]: e.target.value })} />
                      {me?.teacherOnly ? (
                        <Button size="sm" disabled={sub?.status === "submitted" || sub?.status === "approved"} onClick={() => send(c.grade, c.section, sem)}><Send /> Send to admin</Button>
                      ) : me?.isAdmin ? (
                        <>
                          <Button size="sm" disabled={sub?.status === "approved"} onClick={() => review(c.grade, c.section, sem, "approved")}><Check /> Approve & publish</Button>
                          <Button size="sm" variant="outline" disabled={!sub || sub.status === "returned"} onClick={() => review(c.grade, c.section, sem, "returned")}><Undo2 /> Return</Button>
                        </>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
