import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpenCheck, ClipboardList, GraduationCap, Upload, UserPlus, Users } from "lucide-react";
import { studentsQuery, settingsQuery } from "@/lib/queries";
import { GRADES } from "@/lib/school";
import { PageHeader, GlassCard } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Burka Harbu SSS" },
      { name: "description", content: "Overview of students and records." },
      { property: "og:title", content: "Dashboard — Burka Harbu SSS" },
      { property: "og:description", content: "Overview of students and records." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data: students = [], isLoading } = useQuery(studentsQuery);
  const { data: settings } = useQuery(settingsQuery);
  const active = students.filter((s) => s.status === "active");
  const byGrade = GRADES.map((g) => {
    const list = active.filter((s) => s.grade === g);
    return {
      grade: g,
      total: list.length,
      male: list.filter((s) => s.gender === "M").length,
      female: list.filter((s) => s.gender === "F").length,
      sections: new Set(list.map((s) => s.section)).size,
    };
  });
  const graduated = students.filter((s) => s.status === "graduated").length;

  return (
    <div>
      <PageHeader
        eyebrow={settings ? `Academic year ${settings.current_academic_year}` : "Overview"}
        title="Welcome back"
        description="Manage rosters, record semester marks and issue official Grade 9–12 transcripts."
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/students"><Upload /> Import students</Link>
            </Button>
            <Button asChild>
              <Link to="/students"><UserPlus /> Register student</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Active students" value={isLoading ? "…" : active.length} icon={Users} accent="text-primary" />
        <Stat label="Female" value={active.filter((s) => s.gender === "F").length} icon={Users} accent="text-gold" />
        <Stat label="Male" value={active.filter((s) => s.gender === "M").length} icon={Users} accent="text-chart-3" />
        <Stat label="Graduated" value={graduated} icon={GraduationCap} accent="text-gold" />
      </div>

      <h2 className="mb-3 mt-10 text-xl font-semibold">Enrollment by grade</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {byGrade.map((g) => (
          <GlassCard key={g.grade} className="p-5">
            <div className="flex items-baseline justify-between">
              <p className="font-display text-2xl font-semibold">Grade {g.grade}</p>
              <span className="text-xs text-muted-foreground">{g.sections} section{g.sections === 1 ? "" : "s"}</span>
            </div>
            <p className="mt-3 font-display text-4xl font-semibold text-primary tabular">{g.total}</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-gradient-gold" style={{ width: g.total ? `${(g.female / g.total) * 100}%` : "0%" }} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{g.female} female · {g.male} male</p>
          </GlassCard>
        ))}
      </div>

      <h2 className="mb-3 mt-10 text-xl font-semibold">Quick actions</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { to: "/marks" as const, icon: ClipboardList, t: "Enter marks", d: "Semester 1 & 2 mark sheets" },
          { to: "/rosters" as const, icon: BookOpenCheck, t: "Master rosters", d: "Print or export class results" },
          { to: "/transcripts" as const, icon: GraduationCap, t: "Issue transcripts", d: "Grade 9–12 cumulative" },
        ].map((a) => (
          <Link key={a.to} to={a.to} className="glass group rounded-2xl p-5 transition hover:ring-1 hover:ring-primary/40">
            <a.icon className="h-6 w-6 text-gold" />
            <p className="mt-3 font-semibold group-hover:text-primary">{a.t}</p>
            <p className="text-sm text-muted-foreground">{a.d}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, icon: Icon, accent }: { label: string; value: number | string; icon: typeof Users; accent: string }) {
  return (
    <GlassCard className="flex items-center gap-4 p-5">
      <div className="rounded-xl bg-muted p-3"><Icon className={`h-5 w-5 ${accent}`} /></div>
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="font-display text-3xl font-semibold tabular">{value}</p>
      </div>
    </GlassCard>
  );
}
