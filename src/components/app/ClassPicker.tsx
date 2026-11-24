import { GRADES, SECTIONS, defaultStream, hasStreams } from "@/lib/school";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export type ClassSelection = { grade: number; section: string; stream: string | null };

export function ClassPicker({
  value,
  onChange,
  sections,
  classes,
  children,
}: {
  value: ClassSelection;
  onChange: (v: ClassSelection) => void;
  sections?: string[];
  /** When given (teachers), only these classes can be picked. */
  classes?: { grade: number; section: string }[] | undefined;
  children?: React.ReactNode;
}) {
  const secs = sections && sections.length ? sections : [...SECTIONS];
  if (classes) {
    return (
      <div className="glass flex flex-wrap items-end gap-3 rounded-2xl p-4 print:hidden">
        <Pick label="My class">
          <Select
            value={`${value.grade}|${value.section}`}
            onValueChange={(v) => {
              const [g, sec] = v.split("|") as [string, string];
              onChange({ grade: Number(g), section: sec, stream: defaultStream(Number(g), sec) });
            }}
          >
            <SelectTrigger className="w-48"><SelectValue placeholder="No class assigned" /></SelectTrigger>
            <SelectContent>
              {classes.map((c) => (
                <SelectItem key={`${c.grade}|${c.section}`} value={`${c.grade}|${c.section}`}>
                  Grade {c.grade} · Section {c.section}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Pick>
        {children}
      </div>
    );
  }
  return (
    <div className="glass flex flex-wrap items-end gap-3 rounded-2xl p-4 print:hidden">
      <Pick label="Grade">
        <Select
          value={String(value.grade)}
          onValueChange={(v) => {
            const g = Number(v);
            onChange({ ...value, grade: g, stream: hasStreams(g) ? (value.stream ?? "natural") : null });
          }}
        >
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>{GRADES.map((g) => <SelectItem key={g} value={String(g)}>Grade {g}</SelectItem>)}</SelectContent>
        </Select>
      </Pick>
      <Pick label="Section">
        <Select value={value.section} onValueChange={(v) => onChange({ ...value, section: v })}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>{secs.map((s) => <SelectItem key={s} value={s}>Section {s}</SelectItem>)}</SelectContent>
        </Select>
      </Pick>
      {hasStreams(value.grade) && (
        <Pick label="Stream">
          <Select value={value.stream ?? "natural"} onValueChange={(v) => onChange({ ...value, stream: v })}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="natural">Natural Science</SelectItem>
              <SelectItem value="social">Social Science</SelectItem>
            </SelectContent>
          </Select>
        </Pick>
      )}
      {children}
    </div>
  );
}

export function Pick({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

export function inClass(s: { grade: number; section: string; stream: string | null; status: string }, c: ClassSelection) {
  return (
    s.grade === c.grade &&
    s.section === c.section &&
    (!hasStreams(c.grade) || s.stream === c.stream) &&
    s.status !== "transferred"
  );
}
