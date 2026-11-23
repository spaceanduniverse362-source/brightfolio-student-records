import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { toAuthEmail } from "./login";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

async function assertAdmin(context: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!data) throw new Error("Only the admin can manage teacher logins");
}

const validUsername = (u: string) => /^[a-z0-9._-]{3,40}$/.test(u);

export const createTeacherLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { teacherId: string; username: string; password: string }) => ({
    teacherId: String(d.teacherId),
    username: String(d.username ?? "").trim().toLowerCase(),
    password: String(d.password ?? ""),
  }))
  .handler(async ({ data, context }) => {
    try {
      await assertAdmin(context);
      if (!validUsername(data.username)) return { ok: false as const, error: "Username: 3–40 letters, numbers, dot or dash" };
      if (data.password.length < 8) return { ok: false as const, error: "Password needs at least 8 characters" };
      const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
      const { data: teacher } = await db.from("teachers").select("*").eq("id", data.teacherId).maybeSingle();
      if (!teacher) return { ok: false as const, error: "Teacher not found" };
      if (teacher.user_id) return { ok: false as const, error: "This teacher already has a login" };
      const { data: created, error } = await db.auth.admin.createUser({
        email: toAuthEmail(data.username),
        password: data.password,
        email_confirm: true,
        user_metadata: { full_name: teacher.full_name },
      });
      if (error || !created.user) return { ok: false as const, error: error?.message ?? "Could not create login" };
      const uid = created.user.id;
      await db.from("profiles").upsert({ id: uid, email: created.user.email ?? null, full_name: teacher.full_name });
      const { error: e1 } = await db.from("user_roles").insert({ user_id: uid, role: "teacher" });
      const { error: e2 } = await db.from("teachers").update({ user_id: uid, username: data.username }).eq("id", teacher.id);
      if (e1 || e2) return { ok: false as const, error: (e1 ?? e2)!.message };
      return { ok: true as const };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "Failed" };
    }
  });

export const resetTeacherPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { teacherId: string; password: string }) => ({ teacherId: String(d.teacherId), password: String(d.password ?? "") }))
  .handler(async ({ data, context }) => {
    try {
      await assertAdmin(context);
      if (data.password.length < 8) return { ok: false as const, error: "Password needs at least 8 characters" };
      const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
      const { data: teacher } = await db.from("teachers").select("user_id").eq("id", data.teacherId).maybeSingle();
      if (!teacher?.user_id) return { ok: false as const, error: "This teacher has no login yet" };
      const { error } = await db.auth.admin.updateUserById(teacher.user_id, { password: data.password });
      if (error) return { ok: false as const, error: error.message };
      return { ok: true as const };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "Failed" };
    }
  });

export const removeTeacherLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { teacherId: string }) => ({ teacherId: String(d.teacherId) }))
  .handler(async ({ data, context }) => {
    try {
      await assertAdmin(context);
      const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
      const { data: teacher } = await db.from("teachers").select("user_id").eq("id", data.teacherId).maybeSingle();
      if (!teacher?.user_id) return { ok: true as const };
      if (teacher.user_id === context.userId) return { ok: false as const, error: "You can't remove your own login" };
      const { error } = await db.auth.admin.deleteUser(teacher.user_id);
      if (error) return { ok: false as const, error: error.message };
      await db.from("teachers").update({ user_id: null, username: null }).eq("id", data.teacherId);
      return { ok: true as const };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "Failed" };
    }
  });
