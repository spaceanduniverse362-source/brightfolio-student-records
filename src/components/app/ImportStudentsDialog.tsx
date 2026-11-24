import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { downloadWorkbook, readWorkbookSheets } from "@/lib/excel";
import { assignCodes, codePrefix, parseClassSheets, type ImportRow } from "@/lib/classlist";
import { studentsQuery } from "@/lib/queries";
import { chunk } from "@/lib/school";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
  const { data: existing = [] } = useQuery(studentsQuery);
  const input = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ImportRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => {
    const withCodes = assignCodes(parsed, existing, codePrefix(academicYear));
    const seen = new Set<string>();
    return withCodes.filter((r) => (seen.has(r.student_code) ? false : (seen.add(r.student_code), true)));
  }, [parsed, existing, academicYear]);

  const byClass = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(`${r.grade}${r.section}`, (m.get(`${r.grade}${r.section}`) ?? 0) + 1);
    return [...m.entries()];
  }, [rows]);
  const known = useMemo(() => new Set(existing.map((s) => s.student_code)), [existing]);
  const updates = rows.filter((r) => known.has(r.student_code)).length;

  async function onFile(file: File) {
    try {
      const sheets = await readWorkbookSheets(file);
      const { rows: ok, errors: errs } = parseClassSheets(sheets, academicYear);
      setFileName(file.name);
      setParsed(ok);
      setErrors(errs);
      if (!ok.length) toast.error("No students found. Each sheet needs a Name (or Full Name) and Sex column.");
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
      toast.success(`${rows.length} students saved (${rows.length - updates} new, ${updates} updated)`);
      setParsed([]);
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
            Upload your class lists (one sheet per class with a “GRADE 10A” title, Name, F.Name, G.Father and Sex) or
            the template. Student IDs are created automatically; students already registered are updated, not doubled.
          </DialogDescription>
        </DialogHeader>
        <input
          ref={input}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          aria-label="Student spreadsheet"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-azure/50 bg-azure-soft px-6 py-8 text-center transition hover:border-azure"
        >
          <Upload className="h-8 w-8 text-azure" />
          <span className="font-semibold">{fileName || "Choose an Excel or CSV file"}</span>
          <span className="text-xs text-muted-foreground">Click to browse · .xlsx, .xls, .csv</span>
        </button>
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              downloadWorkbook("student-import-template.xlsx", [
                {
                  name: "Students",
                  rows: [
                    ["Student Code", "Full Name", "Gender", "Grade", "Section", "Stream", "Date of Birth", "Admission Number"],
                    ["", "Chaltu Abdisa Gemechu", "F", 9, "A", "", "2011-03-14", "ADM-2019-001"],
                    ["", "Lencho Tolosa Bekele", "M", 11, "B", "Natural", "2009-07-02", "ADM-2017-044"],
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
              <span className="font-semibold text-azure">{rows.length}</span> students ready
              {updates > 0 && <span className="text-muted-foreground"> · {updates} already registered</span>}
              {errors.length > 0 && <span className="text-destructive"> · {errors.length} rows skipped</span>}
            </p>
            {byClass.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {byClass.map(([c, count]) => (
                  <span key={c} className="rounded-full bg-azure-soft px-2.5 py-0.5 text-xs font-medium">
                    {c} · {count}
                  </span>
                ))}
              </div>
            )}
            {errors.length > 0 && (
              <ul className="max-h-24 overflow-y-auto rounded-xl bg-destructive/10 p-3 text-xs text-destructive">
                {errors.slice(0, 50).map((e) => <li key={e}>{e}</li>)}
              </ul>
            )}
            {rows.length > 0 && (
              <div className="max-h-56 overflow-auto rounded-xl border border-glass-border text-xs">
                <table className="w-full">
                  <thead className="sticky top-0 bg-muted text-left">
                    <tr>{["ID", "Name", "Sex", "Class", "Stream"].map((h) => <th key={h} className="px-2 py-1.5">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 150).map((r) => (
                      <tr key={r.student_code} className="border-t border-glass-border">
                        <td className="px-2 py-1 font-mono">{r.student_code}</td>
                        <td className="px-2 py-1">{r.full_name}</td>
                        <td className="px-2 py-1">{r.gender}</td>
                        <td className="px-2 py-1">{r.grade}{r.section}</td>
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
