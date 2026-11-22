import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { downloadWorkbook, pick, readSpreadsheet, toDateString } from "@/lib/excel";
import { chunk, parseGender, parseStream } from "@/lib/school";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Parsed = {
  student_code: string;
  full_name: string;
  gender: "M" | "F";
  grade: number;
  section: string;
  stream: "natural" | "social" | null;
  date_of_birth: string | null;
  admission_number: string | null;
  academic_year: string;
};

export function ImportStudentsDialog({
  open,
  onOpenChange,
  academicYear,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  academicYear: string;
}) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<Parsed[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function onFile(file: File) {
    try {
      const raw = await readSpreadsheet(file);
      const ok: Parsed[] = [];
      const errs: string[] = [];
      raw.forEach((r, i) => {
        const line = i + 2;
        const code = String(pick(r, "Student Code", "Code", "ID", "Student ID") ?? "").trim();
        const name = String(pick(r, "Full Name", "Name", "Student Name") ?? "").trim();
        const gender = parseGender(pick(r, "Gender", "Sex"));
        const grade = Number(pick(r, "Grade"));
        const section = String(pick(r, "Section") ?? "A").trim().toUpperCase().slice(0, 4) || "A";
        const stream = parseStream(pick(r, "Stream"));
        if (!code && !name) return;
        if (!code) return void errs.push(`Row ${line}: missing Student Code`);
        if (!name) return void errs.push(`Row ${line}: missing Full Name`);
        if (!gender) return void errs.push(`Row ${line}: Gender must be M or F`);
        if (![9, 10, 11, 12].includes(grade)) return void errs.push(`Row ${line}: Grade must be 9–12`);
        if (grade >= 11 && !stream) return void errs.push(`Row ${line}: Grade ${grade} needs Stream (Natural/Social)`);
        const admission = pick(r, "Admission Number", "Admission No");
        ok.push({
          student_code: code.slice(0, 40),
          full_name: name.slice(0, 120),
          gender,
          grade,
          section,
          stream: grade >= 11 ? stream : null,
          date_of_birth: toDateString(pick(r, "Date of Birth", "DOB", "Birth Date")),
          admission_number: admission ? String(admission).slice(0, 40) : null,
          academic_year: String(pick(r, "Academic Year", "Year") ?? academicYear).slice(0, 20),
        });
      });
      const seen = new Set<string>();
      const deduped = ok.filter((r) => (seen.has(r.student_code) ? false : (seen.add(r.student_code), true)));
      setRows(deduped);
      setErrors(errs);
    } catch {
      toast.error("Could not read that file. Use .xlsx, .xls or .csv");
    }
  }

  async function importAll() {
    setBusy(true);
    try {
      for (const batch of chunk(rows, 300)) {
        const { error } = await supabase.from("students").upsert(batch, { onConflict: "student_code" });
        if (error) throw error;
      }
      await qc.invalidateQueries({ queryKey: ["students"] });
      toast.success(`${rows.length} students imported`);
      setRows([]);
      setErrors([]);
      onOpenChange(false);
    } catch (e) {
      toast.error((e as { message?: string }).message ?? "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Import students</DialogTitle>
          <DialogDescription>
            Excel or CSV with columns: Student Code, Full Name, Gender, Grade, Section, Stream. Optional: Date of Birth,
            Admission Number, Academic Year. Existing codes are updated.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <label className="cursor-pointer">
              <Upload /> Choose file
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onFile(f);
                  e.target.value = "";
                }}
              />
            </label>
          </Button>
          <Button
            variant="ghost"
            onClick={() =>
              downloadWorkbook("student-import-template.xlsx", [
                {
                  name: "Students",
                  rows: [
                    ["Student Code", "Full Name", "Gender", "Grade", "Section", "Stream", "Date of Birth", "Admission Number"],
                    ["BH-0001", "Chaltu Abdisa Gemechu", "F", 9, "A", "", "2011-03-14", "ADM-2019-001"],
                    ["BH-0002", "Lencho Tolosa Bekele", "M", 11, "B", "Natural", "2009-07-02", "ADM-2017-044"],
                  ],
                  widths: [14, 28, 8, 7, 8, 10, 14, 18],
                },
              ])
            }
          >
            <FileSpreadsheet /> Download template
          </Button>
        </div>
        {(rows.length > 0 || errors.length > 0) && (
          <div className="space-y-3">
            <p className="text-sm">
              <span className="font-semibold text-primary">{rows.length}</span> ready to import
              {errors.length > 0 && <span className="text-destructive"> · {errors.length} rows skipped</span>}
            </p>
            {errors.length > 0 && (
              <ul className="max-h-28 overflow-y-auto rounded-xl bg-destructive/10 p-3 text-xs text-destructive">
                {errors.slice(0, 50).map((e) => <li key={e}>{e}</li>)}
              </ul>
            )}
            {rows.length > 0 && (
              <div className="max-h-56 overflow-auto rounded-xl border border-glass-border text-xs">
                <table className="w-full">
                  <thead className="bg-muted/60 text-left">
                    <tr>{["Code", "Name", "Sex", "Grade", "Sec", "Stream"].map((h) => <th key={h} className="px-2 py-1.5">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 100).map((r) => (
                      <tr key={r.student_code} className="border-t border-glass-border">
                        <td className="px-2 py-1 font-mono">{r.student_code}</td>
                        <td className="px-2 py-1">{r.full_name}</td>
                        <td className="px-2 py-1">{r.gender}</td>
                        <td className="px-2 py-1">{r.grade}</td>
                        <td className="px-2 py-1">{r.section}</td>
                        <td className="px-2 py-1 capitalize">{r.stream ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={importAll} disabled={busy || rows.length === 0}>
                {busy && <Loader2 className="animate-spin" />} Import {rows.length} students
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
