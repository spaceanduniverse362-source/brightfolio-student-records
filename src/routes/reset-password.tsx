import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Emblem } from "@/components/app/Emblem";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set New Password — Burka Harbu SSS" },
      { name: "description", content: "Choose a new password for your staff account." },
      { property: "og:title", content: "Set New Password — Burka Harbu SSS" },
      { property: "og:description", content: "Choose a new password for your staff account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) return void toast.error("Use at least 8 characters");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return void toast.error(error.message);
    toast.success("Password updated");
    navigate({ to: "/dashboard", replace: true });
  }
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className="glass-strong w-full max-w-sm space-y-4 rounded-3xl p-8">
        <Emblem className="mx-auto h-20 w-20" />
        <h1 className="text-center text-2xl font-semibold">Set a new password</h1>
        <div className="space-y-1.5">
          <Label htmlFor="pw">New password</Label>
          <Input id="pw" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>Save password</Button>
      </form>
    </div>
  );
}
