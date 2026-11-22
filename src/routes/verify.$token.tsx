import { createFileRoute } from "@tanstack/react-router";
import { BadgeCheck, XCircle } from "lucide-react";
import { verifyTranscript } from "@/lib/verify.functions";
import { Emblem } from "@/components/app/Emblem";
import { streamLabel } from "@/lib/school";

export const Route = createFileRoute("/verify/$token")({
  loader: async ({ params }) => {
    const ok = /^[0-9a-f-]{36}$/i.test(params.token);
    if (!ok) return { record: null };
    return { record: await verifyTranscript({ data: { token: params.token } }) };
  },
  head: () => ({
    meta: [
      { title: "Transcript Verification — Burka Harbu SSS" },
      { name: "description", content: "Verify an official transcript issued by Burka Harbu Special Secondary School." },
      { property: "og:title", content: "Transcript Verification — Burka Harbu SSS" },
      { property: "og:description", content: "Verify an official Burka Harbu SSS transcript." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VerifyPage,
});

function VerifyPage() {
  const { record } = Route.useLoaderData();
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="glass-strong w-full max-w-md rounded-3xl p-8 text-center animate-float-in">
        <Emblem className="mx-auto h-20 w-20" />
        <p className="mt-4 text-xs uppercase tracking-[0.2em] text-gold">Transcript verification</p>
        {record ? (
          <>
            <BadgeCheck className="mx-auto mt-6 h-12 w-12 text-primary" />
            <h1 className="mt-3 text-2xl font-semibold">Authentic record</h1>
            <p className="mt-1 text-sm text-muted-foreground">Issued by {record.school_name}</p>
            <dl className="mt-6 space-y-2 rounded-2xl bg-muted/50 p-4 text-left text-sm">
              <Row k="Student" v={record.full_name} />
              <Row k="Student ID" v={record.student_code} />
              <Row k="Sex" v={record.gender === "F" ? "Female" : "Male"} />
              <Row k="Stream" v={streamLabel(record.stream)} />
              <Row k="Grades on record" v={record.grades_covered.length ? record.grades_covered.join(", ") : "—"} />
              <Row k="Cumulative average" v={record.cumulative_average != null ? `${Number(record.cumulative_average).toFixed(2)}%` : "—"} />
              <Row k="Status" v={record.status === "graduated" ? "Graduated" : record.status === "transferred" ? "Transferred" : "Enrolled"} />
            </dl>
          </>
        ) : (
          <>
            <XCircle className="mx-auto mt-6 h-12 w-12 text-destructive" />
            <h1 className="mt-3 text-2xl font-semibold">Not found</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This code does not match any transcript issued by the school.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right font-medium">{v}</dd>
    </div>
  );
}
