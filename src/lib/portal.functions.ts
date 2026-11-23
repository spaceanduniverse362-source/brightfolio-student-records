import { createServerFn } from "@tanstack/react-start";
import { computeClassResults, computeTranscript, publishedMarks, reportCards, type ReportCard } from "./results";
import { fetchAll, subjectsFor, type Mark, type Student } from "./school";

export type PortalResult =
  | {
      ok: true;
      card: ReportCard;
      published: { sem1: boolean; sem2: boolean };
      pastYears: { grade: number; annualAverage: number }[];
      cumulativeAverage: number | null;
      school: { name: string; local: string; principal: string; registrar: string };
    }
  | { ok: false; error: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function sameSecret(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Student portal: Student ID + result password -> that student's own published results only. */
export const getMyResult = createServerFn({ method: "POST" })
  .inputValidator((d: { code: string; password: string }) => ({
    code: String(d?.code ?? "").trim().slice(0, 40),
    password: String(d?.password ?? "").trim().toUpperCase().slice(0, 40),
  }))
  .handler(async ({ data }): Promise<PortalResult> => {
    const wrong = async (): Promise<PortalResult> => {
      await sleep(500);
      return { ok: false, error: "Wrong Student ID or password" };
    };
    if (!data.code || !data.password) return wrong();
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");

    const pattern = data.code.replace(/[\\%_]/g, (c) => `\\${c}`);
    const { data: found } = await db.from("students").select("*").ilike("student_code", pattern).limit(1);
    const student = found?.[0] as Student | undefined;
    if (!student || student.status === "transferred") return wrong();
    const { data: login } = await db.from("student_logins").select("password").eq("student_id", student.id).maybeSingle();
    if (!login || !sameSecret(login.password.toUpperCase(), data.password)) return wrong();

    const [{ data: settings }, { data: subjects }] = await Promise.all([
      db.from("school_settings").select("*").eq("id", 1).maybeSingle(),
      db.from("subjects").select("*").order("sort_order"),
    ]);
    const year = settings?.current_academic_year ?? "";
    const passMark = Number(settings?.pass_mark ?? 50);

    let classQ = db.from("students").select("*").eq("grade", student.grade).eq("section", student.section).neq("status", "transferred");
    if (student.grade >= 11 && student.stream) classQ = classQ.eq("stream", student.stream);
    const { data: classmates } = await classQ;
    const mates = (classmates ?? []) as Student[];
    const ids = mates.map((s) => s.id);

    const { data: subs } = await db
      .from("result_submissions")
      .select("semester")
      .eq("grade", student.grade)
      .eq("section", student.section)
      .eq("academic_year", year)
      .eq("status", "approved");
    const published = { sem1: !!subs?.some((s) => s.semester === 1), sem2: !!subs?.some((s) => s.semester === 2) };

    const classMarks = ids.length
      ? await fetchAll<Mark>((f, t) => db.from("marks").select("*").in("student_id", ids).eq("grade", student.grade).order("id").range(f, t))
      : [];
    const ownMarks = await fetchAll<Mark>((f, t) => db.from("marks").select("*").eq("student_id", student.id).order("id").range(f, t));

    const allSubjects = subjects ?? [];
    const classSubjects = subjectsFor(allSubjects, student.grade, student.grade >= 11 ? student.stream : null);
    const rows = computeClassResults(mates, classSubjects, publishedMarks(classMarks, student.grade, published), student.grade, passMark);
    const cards = reportCards(rows, classSubjects, passMark, year);
    const card = cards.find((c) => c.student.id === student.id);
    if (!card) return wrong();

    const transcript = computeTranscript(student, allSubjects, publishedMarks(ownMarks, student.grade, published));
    const pastYears = transcript.years
      .filter((y) => y.grade < student.grade && y.annualAverage !== null)
      .map((y) => ({ grade: y.grade, annualAverage: y.annualAverage! }));

    return {
      ok: true,
      card,
      published,
      pastYears,
      cumulativeAverage: transcript.cumulativeAverage,
      school: {
        name: settings?.school_name ?? "Burka Harbu Special Secondary School",
        local: settings?.school_name_local ?? "",
        principal: settings?.principal_name ?? "",
        registrar: settings?.registrar_name ?? "",
      },
    };
  });
