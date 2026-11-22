import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  BookOpenCheck,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  Settings,
  ShieldAlert,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useStaff } from "@/hooks/use-staff";
import { settingsQuery } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Emblem } from "./Emblem";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/students", label: "Students", icon: Users },
  { to: "/marks", label: "Marks Entry", icon: ClipboardList },
  { to: "/rosters", label: "Master Rosters", icon: BookOpenCheck },
  { to: "/transcripts", label: "Transcripts", icon: GraduationCap },
  { to: "/settings", label: "Settings & Backup", icon: Settings },
] as const;

const IDLE_LOCK_MS = 10 * 60 * 1000;
const LOCK_KEY = "bh-locked";

export function AppShell() {
  const staff = useStaff();
  const { data: settings } = useQuery({ ...settingsQuery, enabled: !!staff.data?.isStaff });
  const [locked, setLocked] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lock = useCallback(() => {
    sessionStorage.setItem(LOCK_KEY, "1");
    setLocked(true);
  }, []);

  useEffect(() => {
    if (sessionStorage.getItem(LOCK_KEY) === "1") setLocked(true);
  }, []);

  useEffect(() => {
    if (locked) return;
    const reset = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        lock();
        toast.info("Locked after 10 minutes of inactivity");
      }, IDLE_LOCK_MS);
    };
    const events = ["mousemove", "keydown", "pointerdown", "scroll", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      if (timer.current) clearTimeout(timer.current);
    };
  }, [locked, lock]);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    sessionStorage.removeItem(LOCK_KEY);
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (staff.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Emblem className="h-20 w-20 animate-pulse" />
      </div>
    );
  }

  if (!staff.data?.isStaff) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="glass-strong max-w-md rounded-3xl p-8 text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-gold" />
          <h1 className="mt-4 text-2xl font-semibold">Awaiting approval</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account <span className="text-foreground">{staff.data?.email}</span> is registered but has
            not been given access yet. Ask the school admin to approve you under Settings → Staff access.
          </p>
          <Button variant="outline" className="mt-6" onClick={signOut}>
            <LogOut /> Sign out
          </Button>
        </div>
      </div>
    );
  }

  if (locked) {
    return (
      <LockScreen
        email={staff.data.email}
        onUnlock={() => {
          sessionStorage.removeItem(LOCK_KEY);
          setLocked(false);
        }}
        onSignOut={signOut}
      />
    );
  }

  const nav = <NavList />;

  return (
    <div className="min-h-screen lg:pl-72 print:pl-0">
      <aside className="glass-strong fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-sidebar-border lg:flex print:hidden">
        <Brand />
        <div className="flex-1 overflow-y-auto px-3 py-4">{nav}</div>
        <div className="border-t border-sidebar-border p-4 text-xs text-muted-foreground">
          <p className="truncate">{staff.data.email}</p>
          <p className="mt-0.5 capitalize text-gold">{staff.data.roles.join(" · ")}</p>
        </div>
      </aside>

      <header className="glass-strong sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-glass-border px-4 md:px-6 print:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="glass-strong w-72 p-0">
            <Brand />
            <div className="px-3 py-4">{nav}</div>
          </SheetContent>
        </Sheet>
        <div className="flex items-center gap-2 lg:hidden">
          <Emblem className="h-8 w-8" />
          <span className="font-display text-sm font-semibold">Burka Harbu SSS</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {settings && (
            <span className="hidden rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-medium text-gold sm:inline">
              Academic year {settings.current_academic_year}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={lock}>
            <Lock /> Lock
          </Button>
          <Button variant="ghost" size="sm" onClick={signOut} aria-label="Sign out">
            <LogOut />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] p-4 md:p-8 print:max-w-none print:p-0">
        <Outlet />
      </main>
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5">
      <Emblem className="h-12 w-12 shrink-0" />
      <div className="min-w-0">
        <p className="font-display text-base font-semibold leading-tight">Burka Harbu</p>
        <p className="text-[11px] uppercase tracking-[0.18em] text-gold">Special Secondary School</p>
      </div>
    </div>
  );
}

function NavList() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => {
        const active = path === item.to || path.startsWith(item.to + "/");
        return (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
              active
                ? "bg-primary/15 text-foreground ring-1 ring-primary/40"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-foreground",
            )}
          >
            <item.icon className={cn("h-4 w-4", active ? "text-primary" : "text-muted-foreground")} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function LockScreen({
  email,
  onUnlock,
  onSignOut,
}: {
  email: string;
  onUnlock: () => void;
  onSignOut: () => void;
}) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error("Incorrect password");
      return;
    }
    setPassword("");
    onUnlock();
  }
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className="glass-strong w-full max-w-sm rounded-3xl p-8 text-center">
        <Emblem className="mx-auto h-20 w-20" />
        <h1 className="mt-4 text-2xl font-semibold">Session locked</h1>
        <p className="mt-1 text-sm text-muted-foreground">{email}</p>
        <Input
          type="password"
          autoFocus
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-6"
          autoComplete="current-password"
        />
        <Button type="submit" className="mt-4 w-full" disabled={busy || !password}>
          <Lock /> Unlock
        </Button>
        <button type="button" onClick={onSignOut} className="mt-4 text-xs text-muted-foreground hover:text-foreground">
          Sign out instead
        </button>
      </form>
    </div>
  );
}
