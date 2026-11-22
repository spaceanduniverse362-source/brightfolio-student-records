import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type StaffInfo = {
  userId: string;
  email: string;
  roles: ("admin" | "registrar")[];
  isAdmin: boolean;
  isStaff: boolean;
};

export function useStaff() {
  return useQuery({
    queryKey: ["staff-me"],
    queryFn: async (): Promise<StaffInfo | null> => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
      if (error) throw error;
      const roles = (data ?? []).map((r) => r.role);
      return {
        userId: u.user.id,
        email: u.user.email ?? "",
        roles,
        isAdmin: roles.includes("admin"),
        isStaff: roles.length > 0,
      };
    },
  });
}
