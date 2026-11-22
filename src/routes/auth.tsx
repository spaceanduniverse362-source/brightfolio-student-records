import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Emblem } from "@/components/app/Emblem";
import { isUsernameLogin, toAuthEmail } from "@/lib/login";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Staff Sign In — Burka Harbu SSS" },
      { name: "description", content: "Secure staff sign in for the Burka Harbu SSS records system." },
      { property: "og:title", content: "Staff Sign In — Burka Harbu SSS" },
      { property: "og:description", content: "Secure staff sign in for the school records system." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email: toAuthEmail(email), password });
        if (error) throw error;
        sessionStorage.removeItem("bh-locked");
        navigate({ to: "/dashboard", replace: true });
      } else if (mode === "signup") {
        if (password.length < 8) throw new Error("Use at least 8 characters for the password");
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin + "/dashboard", data: { full_name: fullName.trim() } },
        });
        if (error) throw error;
        if (data.session) navigate({ to: "/dashboard", replace: true });
        else setNotice("Check your email and click the confirmation link, then sign in.");
      } else {
        if (isUsernameLogin(email)) throw new Error("Username accounts can't reset by email. Ask the main admin.");
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin + "/reset-password",
        });
        if (error) throw error;
        setNotice("If that email has an account, a reset link is on its way.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="glass-strong w-full max-w-md rounded-3xl p-8 animate-float-in">
        <Link to="/" className="flex flex-col items-center text-center">
          <Emblem className="h-24 w-24" />
          <h1 className="mt-4 text-2xl font-semibold">Burka Harbu SSS</h1>
          <p className="text-xs uppercase tracking-[0.2em] text-gold">Records System</p>
        </Link>
        <h2 className="mt-8 text-lg font-semibold">
          {mode === "signin" ? "Staff sign in" : mode === "signup" ? "Create staff account" : "Reset password"}
        </h2>
        {mode === "signup" && (
          <p className="mt-1 text-xs text-muted-foreground">
            The first account becomes the main admin. Later accounts need admin approval.
          </p>
        )}
        <form onSubmit={submit} className="mt-5 space-y-4">
          {mode === "signup" && (
            <div className="space-y-1.5">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={100} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">{mode === "signin" ? "Username or email" : "Email"}</Label>
            <Input
              id="email"
              type={mode === "signin" ? "text" : "email"}
              autoComplete={mode === "signin" ? "username" : "email"}
              autoCapitalize="none"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              maxLength={255}
            />
          </div>
          {mode !== "forgot" && (
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          )}
          {notice && <p className="rounded-xl bg-primary/10 p-3 text-sm text-primary">{notice}</p>}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            {mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
          </Button>
        </form>
        <div className="mt-5 flex justify-between text-xs text-muted-foreground">
          {mode === "signin" ? (
            <>
              <button onClick={() => setMode("forgot")} className="hover:text-foreground">Forgot password?</button>
              <button onClick={() => setMode("signup")} className="hover:text-foreground">Create staff account</button>
            </>
          ) : (
            <button onClick={() => setMode("signin")} className="hover:text-foreground">← Back to sign in</button>
          )}
        </div>
      </div>
    </div>
  );
}
