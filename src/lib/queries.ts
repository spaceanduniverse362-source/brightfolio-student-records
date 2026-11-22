import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { chunk, fetchAll, type Mark, type Student } from "./school";

export const settingsQuery = queryOptions({
  queryKey: ["settings"],
  queryFn: async () => {
    const { data, error } = await supabase.from("school_settings").select("*").eq("id", 1).maybeSingle();
    if (error) throw error;
    return data;
  },
});

export const subjectsQuery = queryOptions({
  queryKey: ["subjects"],
  queryFn: async () => {
    const { data, error } = await supabase.from("subjects").select("*").order("sort_order");
    if (error) throw error;
    return data ?? [];
  },
});

export const studentsQuery = queryOptions({
  queryKey: ["students"],
  queryFn: () =>
    fetchAll<Student>((from, to) =>
      supabase.from("students").select("*").order("grade").order("section").order("full_name").range(from, to),
    ),
});

export async function fetchMarksForStudents(studentIds: string[], grade?: number): Promise<Mark[]> {
  const out: Mark[] = [];
  for (const ids of chunk(studentIds, 80)) {
    const rows = await fetchAll<Mark>((from, to) => {
      let q = supabase.from("marks").select("*").in("student_id", ids);
      if (grade) q = q.eq("grade", grade);
      return q.order("id").range(from, to);
    });
    out.push(...rows);
  }
  return out;
}

export function useClassMarks(studentIds: string[], grade: number) {
  return useQuery({
    queryKey: ["marks", "class", grade, studentIds],
    queryFn: () => fetchMarksForStudents(studentIds, grade),
    enabled: studentIds.length > 0,
  });
}

export function usePhotoUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ["photo", path],
    enabled: !!path,
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("student-photos").createSignedUrl(path!, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

export const cumulativeQuery = queryOptions({
  queryKey: ["cumulative"],
  queryFn: async () => {
    const { data, error } = await supabase.rpc("cumulative_averages");
    if (error) throw error;
    return new Map((data ?? []).map((r) => [r.student_id, { avg: Number(r.cumulative_average), years: r.years_count }]));
  },
});
