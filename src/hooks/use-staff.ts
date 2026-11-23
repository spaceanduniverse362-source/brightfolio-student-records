import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Role = "admin" | "registrar" | "teacher";

export type StaffInfo = {
  userId: string;
  email: string;
  roles: Role[];
  isAdmin: boolean;
  /** Admin or registrar: full records access. */
  isStaff: boolean;
  isTeacher: boolean;
  /** Teacher (and not admin/registrar): limited to assigned classes. */
  teacherOnly: boolean;
};

export function useStaff() {
  return useQuery({
    queryKey: ["staff-me"],
    queryFn: async (): Promise<StaffInfo | null> => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
      if (error) throw error;
      const roles = (data ?? []).map((r) => r.role as Role);
      const isStaff = roles.includes("admin") || roles.includes("registrar");
      const isTeacher = roles.includes("teacher");
      return {
        userId: u.user.id,
        email: u.user.email ?? "",
        roles,
        isAdmin: roles.includes("admin"),
        isStaff,
        isTeacher,
        teacherOnly: isTeacher && !isStaff,
      };
    },
  });
}
