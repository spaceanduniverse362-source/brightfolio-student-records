import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import { cumulativeQuery, studentsQuery } from "@/lib/queries";
import { GRADES, streamLabel } from "@/lib/school";
import { rankBy } from "@/lib/grading";
import { fmt } from "@/lib/results";
import { PageHeader } from "@/components/app/PageHeader";
import { StudentPhoto } from "@/components/app/StudentPhoto";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/transcripts/")({
  head: () => ({
    meta: [
      { title: "Transcripts — Burka Harbu SSS" },
      { name: "description", content: "Issue official Grade 9–12 cumulative transcripts." },
      { property: "og:title", content: "Transcripts — Burka Harbu SSS" },
      { property: "og:description", content: "Issue official Grade 9–12 cumulative transcripts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TranscriptsPage,
});

function TranscriptsPage() {
  const { data: students = [] } = useQuery(studentsQuery);
  const { data: cum } = useQuery(cumulativeQuery);
  const [grade, setGrade] = useState("12");
  const [stream, setStream] = useState("all");
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return students
      .filter((s) => s.status !== "transferred")
      .filter((s) => (grade === "graduated" ? s.status === "graduated" : s.grade === Number(grade) && s.status === "active"))
      .filter((s) => stream === "all" || s.stream === stream)
      .filter((s) => !needle || s.full_name.toLowerCase().includes(needle) || s.student_code.toLowerCase().includes(needle));
  }, [students, grade, stream, q]);

  const ranks = useMemo(() => {
    const m = new Map<string, number | null>();
    for (const st of ["natural", "social", null]) {
      const group = list.filter((s) => (s.stream ?? null) === st);
      const r = rankBy(group, (s) => cum?.get(s.id)?.avg ?? null);
      group.forEach((s) => m.set(s.id, r.get(s) ?? null));
    }
    return m;
  }, [list, cum]);

  const sorted = [...list].sort((a, b) => (ranks.get(a.id) ?? 9999) - (ranks.get(b.id) ?? 9999) || a.full_name.localeCompare(b.full_name));

  return (
    <div>
      <PageHeader
        eyebrow="Grade 9 – 12 cumulative"
        title="Official transcripts"
        description="Choose a student to preview, print or save their 4-year transcript as PDF."
      />
      <div className="glass mb-4 flex flex-wrap items-center gap-3 rounded-2xl p-4">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by name or ID" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <Select value={grade} onValueChange={setGrade}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            {GRADES.map((g) => <SelectItem key={g} value={String(g)}>Grade {g}{g === 12 ? " (graduating)" : ""}</SelectItem>)}
            <SelectItem value="graduated">Graduated alumni</SelectItem>
          </SelectContent>
        </Select>
        <Select value={stream} onValueChange={setStream}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All streams</SelectItem>
            <SelectItem value="natural">Natural Science</SelectItem>
            <SelectItem value="social">Social Science</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {sorted.length === 0 && <p className="text-sm text-muted-foreground">No students found.</p>}
        {sorted.map((s) => {
          const c = cum?.get(s.id);
          return (
            <Link
              key={s.id}
              to="/transcripts/$studentId"
              params={{ studentId: s.id }}
              className="glass group flex items-center gap-4 rounded-2xl p-4 transition hover:ring-1 hover:ring-primary/40"
            >
              <StudentPhoto path={s.photo_path} name={s.full_name} className="h-12 w-12" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold group-hover:text-primary">{s.full_name}</p>
                <p className="text-xs text-muted-foreground">
                  <span className="font-mono">{s.student_code}</span> · {s.grade}{s.section} · {streamLabel(s.stream)}
                </p>
                <p className="mt-1 text-xs">
                  <span className="text-gold">Cum. avg {fmt(c?.avg ?? null, 2)}</span>
                  <span className="text-muted-foreground"> · {c?.years ?? 0}/4 years · rank {ranks.get(s.id) ?? "—"}</span>
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
