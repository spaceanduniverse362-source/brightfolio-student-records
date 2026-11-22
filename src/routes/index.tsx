import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, FileCheck2, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Emblem } from "@/components/app/Emblem";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Burka Harbu Special Secondary School — Records Portal" },
      {
        name: "description",
        content:
          "Official records portal of Burka Harbu Special Secondary School: student rosters, semester marks and Grade 9–12 transcripts.",
      },
      { property: "og:title", content: "Burka Harbu Special Secondary School — Records Portal" },
      {
        property: "og:description",
        content: "Student rosters, semester marks and official Grade 9–12 transcripts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-16">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.04]">
        <Emblem variant="light" className="h-[48rem] w-[48rem]" />
      </div>
      <div className="relative flex max-w-3xl flex-col items-center text-center animate-float-in">
        <Emblem className="h-36 w-36 shadow-2xl md:h-44 md:w-44" />
        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.3em] text-gold">
          Mana Barumsa Addaa Burqa Harbuu Sadarkaa Lammaffaa
        </p>
        <h1 className="mt-4 text-4xl font-semibold leading-tight md:text-6xl">
          Burka Harbu <span className="text-gold-gradient">Special Secondary School</span>
        </h1>
        <p className="mt-5 max-w-xl text-base text-muted-foreground md:text-lg">
          Official Transcript &amp; Student Roster System for Grades 9 – 12.
        </p>
        <Button asChild size="lg" className="mt-10 h-12 rounded-full px-8 text-base">
          <Link to="/auth">
            Staff sign in <ArrowRight />
          </Link>
        </Button>
      </div>
      <div className="relative mt-16 grid w-full max-w-4xl gap-4 sm:grid-cols-3">
        {[
          { icon: Users, t: "Class rosters", d: "Grades 9–12, sections & streams" },
          { icon: FileCheck2, t: "Official transcripts", d: "4-year cumulative, QR verified" },
          { icon: ShieldCheck, t: "Secure records", d: "Staff-only access, auto lock" },
        ].map((f) => (
          <div key={f.t} className="glass rounded-2xl p-5 text-left">
            <f.icon className="h-5 w-5 text-primary" />
            <p className="mt-3 font-semibold">{f.t}</p>
            <p className="text-sm text-muted-foreground">{f.d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
