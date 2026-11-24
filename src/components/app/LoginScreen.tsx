import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, GraduationCap, Loader2, Presentation, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getMyResult } from "@/lib/portal.functions";
import { toAuthEmail } from "@/lib/login";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Emblem } from "./Emblem";
import { cn } from "@/lib/utils";

export const STUDENT_SESSION_KEY = "bh-student";

type Who = "admin" | "teacher" | "student";

const TABS: { id: Who; label: string; icon: typeof ShieldCheck; hint: string }[] = [
  { id: "admin", label: "Admin", icon: ShieldCheck, hint: "School administration — full access" },
  { id: "teacher", label: "Teacher", icon: Presentation, hint: "Enter marks and send class results" },
  { id: "student", label: "Student", icon: GraduationCap, hint: "See your own results" },
];

async function rolesOf(userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).map((r) => r.role as string);
}

export function LoginScreen() {
  const navigate = useNavigate();
  const checkResult = useServerFn(getMyResult);
  const [who, setWho] = useState<Who>("admin");
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user && (await rolesOf(data.user.id)).length) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (who === "student") {
        const res = await checkResult({ data: { code: id, password } });
        if (!res.ok) throw new Error(res.error);
        sessionStorage.setItem(STUDENT_SESSION_KEY, JSON.stringify({ code: id.trim(), password: password.trim() }));
        navigate({ to: "/my-result" });
        return;
      }
      const { data, error } = await supabase.auth.signInWithPassword({ email: toAuthEmail(id), password });
      if (error) throw new Error("Wrong username or password");
      const roles = await rolesOf(data.user.id);
      const allowed = who === "admin" ? roles.some((r) => r === "admin" || r === "registrar") : roles.includes("teacher");
      if (!allowed) {
        await supabase.auth.signOut();
        throw new Error(who === "admin" ? "This account is not an admin account" : "This account is not a teacher account");
      }
      sessionStorage.removeItem("bh-locked");
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  const tab = TABS.find((t) => t.id === who)!;
  const student = who === "student";

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute -left-40 top-1/2 -translate-y-1/2 opacity-[0.05]">
        <Emblem variant="light" className="h-[46rem] w-[46rem]" />
      </div>
      <div className="relative grid w-full max-w-5xl items-center gap-10 md:grid-cols-[1.05fr_1fr]">
        <div className="hidden flex-col items-start md:flex animate-float-in">
          <Emblem className="h-28 w-28 shadow-2xl" />
          <p className="mt-7 text-[11px] font-semibold uppercase tracking-[0.3em] text-gold">
            Mana Barumsa Addaa Burqa Harbuu Sadarkaa Lammaffaa
          </p>
          <h1 className="mt-3 text-5xl font-semibold leading-[1.05]">
            Burka Harbu <span className="text-gold-gradient">Special Secondary School</span>
          </h1>
          <p className="mt-5 max-w-md text-muted-foreground">
            Results, rosters and report cards for Grades 9 – 12. Choose who you are and sign in.
          </p>
          <div className="mt-8 flex gap-2">
            {TABS.map((t) => (
              <span key={t.id} className="glass flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-muted-foreground">
                <t.icon className="h-3.5 w-3.5 text-azure" /> {t.label}
              </span>
            ))}
          </div>
        </div>

        <div className="frame-azure rounded-[2rem] animate-float-in">
          <div className="rounded-[1.65rem] bg-background/95 p-7 md:p-9">
            <div className="flex items-center gap-3 md:hidden">
              <Emblem className="h-14 w-14" />
              <div>
                <p className="font-display text-lg font-semibold leading-tight">Burka Harbu SSS</p>
                <p className="text-[10px] uppercase tracking-[0.2em] text-gold">Results portal</p>
              </div>
            </div>
            <h2 className="mt-6 text-3xl font-semibold md:mt-0">Sign in</h2>
            <p className="mt-1 text-sm text-muted-foreground">{tab.hint}</p>

            <div role="tablist" aria-label="Who is signing in" className="mt-6 grid grid-cols-3 gap-1.5 rounded-2xl bg-muted/60 p-1.5">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  type="button"
                  aria-selected={who === t.id}
                  onClick={() => { setWho(t.id); setId(""); setPassword(""); }}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl px-2 py-2.5 text-xs font-semibold transition",
                    who === t.id ? "bg-gradient-azure text-azure-foreground glow-azure" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <t.icon className="h-5 w-5" />
                  {t.label}
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="login-id">{student ? "Student ID" : "Username"}</Label>
                <Input
                  id="login-id"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder={student ? "e.g. BH19-0001" : who === "admin" ? "admin username" : "your username"}
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  required
                  maxLength={120}
                  className="h-12 rounded-xl text-base"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="login-password">Password</Label>
                <div className="relative">
                  <Input
                    id="login-password"
                    type={show ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    maxLength={100}
                    className="h-12 rounded-xl pr-11 text-base"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    aria-label={show ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" disabled={busy} className="h-12 w-full rounded-xl bg-gradient-azure text-base text-azure-foreground hover:opacity-95">
                {busy && <Loader2 className="animate-spin" />}
                {student ? "See my results" : `Sign in as ${tab.label.toLowerCase()}`}
              </Button>
            </form>
            <p className="mt-5 text-center text-xs text-muted-foreground">
              {student
                ? "Your Student ID and password are given by the school office."
                : "Forgot your password? Ask the school admin to reset it."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
