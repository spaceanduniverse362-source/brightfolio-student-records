import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Award, Download, Loader2, LogOut, TrendingUp, Trophy } from "lucide-react";
import { toast } from "sonner";
import { getMyResult } from "@/lib/portal.functions";
import { fmt, ordinal } from "@/lib/results";
import { genderLabel, streamLabel } from "@/lib/school";
import { STUDENT_SESSION_KEY } from "@/components/app/LoginScreen";
import { Emblem } from "@/components/app/Emblem";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/my-result")({
  head: () => ({
    meta: [
      { title: "My Results — Burka Harbu SSS" },
      { name: "description", content: "Your annual average, rank and subject results at Burka Harbu Special Secondary School." },
      { property: "og:title", content: "My Results — Burka Harbu SSS" },
      { property: "og:description", content: "Your annual average, rank and subject results." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MyResultPage,
});

type Creds = { code: string; password: string };

function MyResultPage() {
  const navigate = useNavigate();
  const fetchResult = useServerFn(getMyResult);
  const [creds, setCreds] = useState<Creds | null | undefined>(undefined);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STUDENT_SESSION_KEY);
      setCreds(raw ? (JSON.parse(raw) as Creds) : null);
    } catch {
      setCreds(null);
    }
  }, []);

  useEffect(() => {
    if (creds === null) navigate({ to: "/", replace: true });
  }, [creds, navigate]);

  const q = useQuery({
    queryKey: ["my-result", creds?.code],
    enabled: !!creds,
    queryFn: () => fetchResult({ data: creds! }),
    staleTime: 60_000,
  });

  function signOut() {
    sessionStorage.removeItem(STUDENT_SESSION_KEY);
    navigate({ to: "/", replace: true });
  }

  const res = q.data;
  if (!creds || q.isLoading || !res) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Emblem className="h-20 w-20 animate-pulse" />
      </div>
    );
  }
  if (!res.ok) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-lg">{res.error}</p>
        <Button onClick={signOut}>Back to sign in</Button>
      </div>
    );
  }

  const { card, published, school } = res;
  const s = card.student;
  const anyPublished = published.sem1 || published.sem2;
  const avg = card.annual.average;

  async function download() {
    if (!res?.ok) return;
    setDownloading(true);
    try {
      const { reportCardsPdf, downloadBlob, reportCardFileName } = await import("@/lib/pdf");
      downloadBlob(await reportCardsPdf([res.card], res.school), reportCardFileName(res.card));
    } catch {
      toast.error("Could not create the PDF");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="min-h-screen px-4 py-8 md:py-12">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Emblem className="h-12 w-12" />
            <div>
              <p className="font-display text-base font-semibold leading-tight">{school.name}</p>
              <p className="text-[11px] uppercase tracking-[0.18em] text-azure">Student results</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={signOut}><LogOut /> Sign out</Button>
        </div>

        <div className="frame-azure rounded-[2rem] animate-float-in">
          <div className="rounded-[1.65rem] bg-gradient-azure-soft p-6 md:p-10">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-azure">Academic year {card.academicYear}</p>
                <h1 className="mt-2 text-3xl font-semibold md:text-4xl">{s.full_name}</h1>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {[s.student_code, `Grade ${s.grade} · Section ${s.section}`, s.grade >= 11 ? streamLabel(s.stream) : null, genderLabel(s.gender)]
                    .filter(Boolean)
                    .map((t) => (
                      <span key={t} className="rounded-full border border-azure/40 bg-azure-soft px-3 py-1 font-medium">{t}</span>
                    ))}
                </div>
              </div>
              <div className="flex h-36 w-36 shrink-0 flex-col items-center justify-center self-center rounded-full border-[6px] border-azure bg-background/60 glow-azure">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Annual avg</span>
                <span className="font-display text-4xl font-semibold tabular">{anyPublished ? fmt(avg, 2) : "—"}</span>
                <span className="text-[10px] text-muted-foreground">out of 100</span>
              </div>
            </div>

            {!anyPublished ? (
              <div className="mt-8 rounded-2xl border-2 border-dashed border-azure/50 p-8 text-center">
                <p className="text-lg font-semibold">Your results are not published yet</p>
                <p className="mt-1 text-sm text-muted-foreground">Check again after the school approves this year's results.</p>
              </div>
            ) : (
              <>
                <div className="mt-8 grid gap-3 sm:grid-cols-3">
                  <Tile icon={Trophy} label="Rank in class" value={card.annual.rank ? ordinal(card.annual.rank) : "—"} sub={`out of ${card.classSize} students`} />
                  <Tile icon={TrendingUp} label="Total" value={fmt(card.annual.total)} sub={`Sem I ${fmt(card.sem1.total)} · Sem II ${fmt(card.sem2.total)}`} />
                  <Tile
                    icon={Award}
                    label="Result"
                    value={card.pass === null ? "—" : card.pass ? "Passed" : "Not passed"}
                    sub={`Pass mark ${card.passMark}`}
                    tone={card.pass === null ? undefined : card.pass ? "good" : "bad"}
                  />
                </div>

                <div className="mt-6 overflow-hidden rounded-2xl border-4 border-azure-deep">
                  <table className="w-full text-sm tabular">
                    <thead className="bg-gradient-azure text-azure-foreground">
                      <tr>
                        <th className="px-4 py-3 text-left">Subject</th>
                        <th className="px-3 py-3">Sem I</th>
                        <th className="px-3 py-3">Sem II</th>
                        <th className="px-3 py-3">Annual</th>
                        <th className="px-3 py-3">Grade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {card.subjects.map((r) => (
                        <tr key={r.code} className="border-t border-azure/20 odd:bg-background/40 even:bg-azure-soft">
                          <td className="px-4 py-2.5 font-medium">{r.name}</td>
                          {[r.sem1, r.sem2, r.annual].map((v, i) => (
                            <td key={i} className={cn("px-3 py-2.5 text-center", v !== null && v < card.passMark && "font-semibold text-destructive")}>
                              {published[i === 0 ? "sem1" : "sem2"] || i === 2 ? fmt(v) : "·"}
                            </td>
                          ))}
                          <td className="px-3 py-2.5 text-center font-semibold text-azure">{r.letter ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-azure-deep text-azure-foreground">
                      <tr>
                        <td className="px-4 py-2.5 font-semibold">Average</td>
                        <td className="px-3 py-2.5 text-center">{fmt(card.sem1.average, 2)}</td>
                        <td className="px-3 py-2.5 text-center">{fmt(card.sem2.average, 2)}</td>
                        <td className="px-3 py-2.5 text-center font-bold">{fmt(card.annual.average, 2)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
                {!published.sem2 && (
                  <p className="mt-3 text-xs text-muted-foreground">Semester II is not published yet — the annual figures use Semester I only.</p>
                )}
              </>
            )}

            {(res.pastYears.length > 0 || res.cumulativeAverage !== null) && (
              <div className="mt-8">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-azure">Year by year</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  {res.pastYears.map((y) => (
                    <div key={y.grade} className="rounded-xl border-2 border-azure/40 bg-background/40 px-4 py-2">
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Grade {y.grade}</p>
                      <p className="font-display text-xl font-semibold tabular">{fmt(y.annualAverage, 2)}</p>
                    </div>
                  ))}
                  {res.cumulativeAverage !== null && (
                    <div className="rounded-xl border-2 border-gold/60 bg-gold/10 px-4 py-2">
                      <p className="text-[10px] uppercase tracking-widest text-gold">Cumulative</p>
                      <p className="font-display text-xl font-semibold tabular">{fmt(res.cumulativeAverage, 2)}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {anyPublished && (
              <div className="mt-8 flex justify-end">
                <Button onClick={download} disabled={downloading} className="bg-gradient-azure text-azure-foreground">
                  {downloading ? <Loader2 className="animate-spin" /> : <Download />} Download my report card (PDF)
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Tile({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: typeof Trophy;
  label: string;
  value: string;
  sub: string;
  tone?: "good" | "bad" | undefined;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border-[3px] bg-background/50 p-4",
        tone === "good" ? "border-success" : tone === "bad" ? "border-destructive" : "border-azure",
      )}
    >
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <Icon className="h-4 w-4 text-azure" /> {label}
      </div>
      <p className={cn("mt-2 font-display text-3xl font-semibold", tone === "good" && "text-success", tone === "bad" && "text-destructive")}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}
