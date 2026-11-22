import { useEffect, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, ImageUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { GRADES, SECTIONS, hasStreams, type Student } from "@/lib/school";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CameraCapture } from "./CameraCapture";
import { StudentPhoto } from "./StudentPhoto";

const schema = z.object({
  student_code: z.string().trim().min(1, "Student code is required").max(40),
  full_name: z.string().trim().min(2, "Full name is required").max(120),
  gender: z.enum(["M", "F"]),
  date_of_birth: z.string().nullable(),
  admission_number: z.string().trim().max(40).nullable(),
  admission_date: z.string().nullable(),
  grade: z.number().int().min(9).max(12),
  section: z.string().trim().min(1).max(4),
  stream: z.enum(["natural", "social"]).nullable(),
  academic_year: z.string().trim().max(20),
  status: z.enum(["active", "graduated", "transferred"]),
});

type FormState = z.infer<typeof schema>;

function initial(s: Student | null, year: string): FormState {
  return {
    student_code: s?.student_code ?? "",
    full_name: s?.full_name ?? "",
    gender: (s?.gender as "M" | "F") ?? "M",
    date_of_birth: s?.date_of_birth ?? null,
    admission_number: s?.admission_number ?? null,
    admission_date: s?.admission_date ?? null,
    grade: s?.grade ?? 9,
    section: s?.section ?? "A",
    stream: (s?.stream as "natural" | "social" | null) ?? null,
    academic_year: s?.academic_year ?? year,
    status: (s?.status as FormState["status"]) ?? "active",
  };
}

export function StudentDialog({
  open,
  onOpenChange,
  student,
  academicYear,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  student: Student | null;
  academicYear: string;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(() => initial(student, academicYear));
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [camera, setCamera] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(initial(student, academicYear));
      setPhoto(null);
      setPreview(null);
      setCamera(false);
    }
  }, [open, student, academicYear]);

  useEffect(() => {
    if (!photo) return;
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ ...form, stream: hasStreams(form.grade) ? form.stream : null });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check the form");
      return;
    }
    setBusy(true);
    try {
      const values = { ...parsed.data, admission_number: parsed.data.admission_number || null };
      let id = student?.id;
      if (id) {
        const { error } = await supabase.from("students").update(values).eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("students").insert(values).select("id").single();
        if (error) throw error;
        id = data.id;
      }
      if (photo && id) {
        const path = `${id}/${Date.now()}.jpg`;
        const { error: upErr } = await supabase.storage
          .from("student-photos")
          .upload(path, photo, { contentType: photo.type || "image/jpeg", upsert: true });
        if (upErr) throw upErr;
        const { error } = await supabase.from("students").update({ photo_path: path }).eq("id", id);
        if (error) throw error;
      }
      await qc.invalidateQueries({ queryKey: ["students"] });
      toast.success(student ? "Student updated" : "Student registered");
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String((err as { message?: string })?.message ?? err);
      toast.error(msg.includes("duplicate") ? "That student code is already used" : msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{student ? "Edit student" : "Register student"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-6 md:grid-cols-[180px_1fr]">
          <div className="space-y-3">
            {camera ? (
              <CameraCapture
                onCapture={(b) => {
                  setPhoto(b);
                  setCamera(false);
                }}
                onClose={() => setCamera(false)}
              />
            ) : (
              <>
                {preview ? (
                  <img src={preview} alt="New photo" className="aspect-[4/5] w-full rounded-xl object-cover" />
                ) : (
                  <StudentPhoto path={student?.photo_path} name={form.full_name} className="aspect-[4/5] w-full rounded-xl" />
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setCamera(true)}>
                    <Camera /> Camera
                  </Button>
                  <Button type="button" variant="outline" size="sm" asChild>
                    <label className="cursor-pointer">
                      <ImageUp /> Upload
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f && f.size > 5 * 1024 * 1024) return void toast.error("Photo must be under 5 MB");
                          if (f) setPhoto(f);
                        }}
                      />
                    </label>
                  </Button>
                </div>
              </>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Student code / ID">
              <Input value={form.student_code} onChange={(e) => set("student_code", e.target.value)} required />
            </Field>
            <Field label="Admission number">
              <Input value={form.admission_number ?? ""} onChange={(e) => set("admission_number", e.target.value)} />
            </Field>
            <Field label="Full legal name" className="sm:col-span-2">
              <Input value={form.full_name} onChange={(e) => set("full_name", e.target.value)} required />
            </Field>
            <Field label="Sex">
              <Select value={form.gender} onValueChange={(v) => set("gender", v as "M" | "F")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">Male</SelectItem>
                  <SelectItem value="F">Female</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Date of birth">
              <Input type="date" value={form.date_of_birth ?? ""} onChange={(e) => set("date_of_birth", e.target.value || null)} />
            </Field>
            <Field label="Grade">
              <Select value={String(form.grade)} onValueChange={(v) => set("grade", Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GRADES.map((g) => <SelectItem key={g} value={String(g)}>Grade {g}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Section">
              <Select value={form.section} onValueChange={(v) => set("section", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SECTIONS.map((s) => <SelectItem key={s} value={s}>Section {s}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            {hasStreams(form.grade) && (
              <Field label="Stream">
                <Select value={form.stream ?? ""} onValueChange={(v) => set("stream", v as "natural" | "social")}>
                  <SelectTrigger><SelectValue placeholder="Choose stream" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="natural">Natural Science</SelectItem>
                    <SelectItem value="social">Social Science</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            )}
            <Field label="Academic year">
              <Input value={form.academic_year} onChange={(e) => set("academic_year", e.target.value)} />
            </Field>
            <Field label="Admission date">
              <Input type="date" value={form.admission_date ?? ""} onChange={(e) => set("admission_date", e.target.value || null)} />
            </Field>
            <Field label="Status">
              <Select value={form.status} onValueChange={(v) => set("status", v as FormState["status"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="graduated">Graduated</SelectItem>
                  <SelectItem value="transferred">Transferred</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="animate-spin" />} {student ? "Save changes" : "Register"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
