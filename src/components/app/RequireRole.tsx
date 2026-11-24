import type { ReactNode } from "react";
import { ShieldAlert } from "lucide-react";
import { useStaff } from "@/hooks/use-staff";

/** Hides admin/staff pages from teachers. The database enforces the same rules. */
export function RequireRole({ role, children }: { role: "admin" | "staff"; children: ReactNode }) {
  const { data, isLoading } = useStaff();
  if (isLoading) return null;
  const ok = role === "admin" ? data?.isAdmin : data?.isStaff;
  if (ok) return <>{children}</>;
  return (
    <div className="glass mx-auto mt-16 max-w-md rounded-3xl p-8 text-center">
      <ShieldAlert className="mx-auto h-10 w-10 text-gold" />
      <h1 className="mt-4 text-2xl font-semibold">Admin only</h1>
      <p className="mt-2 text-sm text-muted-foreground">This page is only for the school administration.</p>
    </div>
  );
}
