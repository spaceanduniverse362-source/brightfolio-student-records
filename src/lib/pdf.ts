/**
 * Report cards and master rosters as real PDF files (browser only).
 * jsPDF, autotable and JSZip are loaded on demand so they stay out of SSR and the first page load.
 */
import emblemBadge from "@/assets/emblem.jpg.asset.json";
import emblemInk from "@/assets/emblem-ink.png.asset.json";
import { GRADE_SCALE } from "./grading";
import { fmt, ordinal, type ClassResultRow, type Period, type ReportCard } from "./results";
import { classLabel, genderLabel, streamLabel, type Subject } from "./school";

type RGB = [number, number, number];
const NAVY: RGB = [11, 26, 63];
const BLUE: RGB = [29, 78, 216];
const SKY: RGB = [96, 165, 250];
const TINT: RGB = [238, 244, 255];
const ROW: RGB = [246, 249, 255];
const GOLD: RGB = [201, 162, 39];
const RED: RGB = [198, 40, 40];
const GREEN: RGB = [21, 128, 61];
const INK: RGB = [17, 24, 39];
const MUTED: RGB = [100, 116, 139];

export type DocSchool = { name: string; local: string; principal: string; registrar: string };

type Images = { badge: string; ink: string };
let imagesPromise: Promise<Images> | null = null;

async function rasterize(url: string, size: number, type: "image/jpeg" | "image/png"): Promise<string> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = url;
  await img.decode();
  const c = document.createElement("canvas");
  c.width = size;
  c.height = Math.round((img.naturalHeight / img.naturalWidth) * size);
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL(type, 0.85);
}

function loadImages(): Promise<Images> {
  imagesPromise ??= Promise.all([
    rasterize(emblemBadge.url, 260, "image/jpeg"),
    rasterize(emblemInk.url, 300, "image/png"),
  ]).then(([badge, ink]) => ({ badge, ink }));
  return imagesPromise;
}

async function libs() {
  const [{ jsPDF, GState }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  return { jsPDF, GState, autoTable };
}
type Libs = Awaited<ReturnType<typeof libs>>;
type Doc = InstanceType<Libs["jsPDF"]>;

const finalY = (doc: Doc) => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
const n = (v: number | null | undefined, d = 1) => (v === null || v === undefined ? "-" : fmt(v, d));

function frame(doc: Doc) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(2.4);
  doc.rect(6, 6, w - 12, h - 12);
  doc.setDrawColor(...BLUE);
  doc.setLineWidth(0.7);
  doc.rect(9.5, 9.5, w - 19, h - 19);
  doc.setFillColor(...GOLD);
  for (const [x, y] of [[8, 8], [w - 12, 8], [8, h - 12], [w - 12, h - 12]] as const) doc.rect(x, y, 4, 4, "F");
}

function watermark(doc: Doc, lib: Libs, img: Images, size: number) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.saveGraphicsState();
  doc.setGState(new lib.GState({ opacity: 0.06 }));
  doc.addImage(img.ink, "PNG", (w - size) / 2, (h - size) / 2 + 8, size, size, "ink", "FAST");
  doc.restoreGraphicsState();
}

function banner(doc: Doc, img: Images, school: DocSchool, title: string, sub: string, badge?: string) {
  const w = doc.internal.pageSize.getWidth();
  const x = 13;
  const bw = w - 26;
  doc.setFillColor(...NAVY);
  doc.roundedRect(x, 13, bw, 33, 2.5, 2.5, "F");
  doc.setFillColor(...BLUE);
  doc.rect(x, 43.5, bw, 2.5, "F");
  doc.addImage(img.badge, "JPEG", x + 4, 15, 27, 27, "badge", "FAST");
  const cx = w / 2;
  doc.setTextColor(...SKY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(school.local.toUpperCase(), cx, 20, { align: "center" });
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(school.name.toUpperCase(), cx, 27.5, { align: "center" });
  doc.setTextColor(...GOLD);
  doc.setFontSize(11);
  doc.text(title, cx, 34.5, { align: "center" });
  doc.setTextColor(203, 213, 225);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(sub, cx, 40, { align: "center" });
  if (badge) {
    doc.setFillColor(...BLUE);
    doc.roundedRect(x + bw - 33, 19, 29, 20, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(6.5);
    doc.text("CLASS", x + bw - 18.5, 24, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(badge, x + bw - 18.5, 33, { align: "center" });
  }
}

function signatures(doc: Doc, y: number, school: DocSchool) {
  const w = doc.internal.pageSize.getWidth();
  const cols = [
    { label: "Homeroom teacher", name: "" },
    { label: "Registrar", name: school.registrar },
    { label: "Principal", name: school.principal },
  ];
  const span = (w - 40) / cols.length;
  cols.forEach((c, i) => {
    const x = 20 + i * span + 6;
    const lw = span - 12;
    doc.setDrawColor(...NAVY);
    doc.setLineWidth(0.3);
    doc.line(x, y, x + lw, y);
    doc.setTextColor(...INK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    if (c.name) doc.text(c.name, x + lw / 2, y + 4, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    doc.setFontSize(6.5);
    doc.text(c.label.toUpperCase(), x + lw / 2, y + (c.name ? 8 : 4.5), { align: "center" });
  });
}

function footer(doc: Doc, text: string) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.setTextColor(...MUTED);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.text(text, w / 2, h - 12.5, { align: "center" });
}

function statBox(doc: Doc, x: number, y: number, w: number, label: string, value: string, sub: string, fill?: RGB) {
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.5);
  doc.setFillColor(...(fill ?? ([255, 255, 255] as RGB)));
  doc.roundedRect(x, y, w, 24, 1.5, 1.5, "FD");
  doc.setFillColor(...NAVY);
  doc.rect(x + 0.25, y + 0.25, w - 0.5, 6, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text(label.toUpperCase(), x + w / 2, y + 4.4, { align: "center" });
  doc.setTextColor(...(fill ? ([255, 255, 255] as RGB) : NAVY));
  doc.setFontSize(15);
  doc.text(value, x + w / 2, y + 15.5, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...(fill ? ([240, 253, 244] as RGB) : MUTED));
  doc.text(sub, x + w / 2, y + 21, { align: "center" });
}

function drawReportCard(doc: Doc, lib: Libs, img: Images, card: ReportCard, school: DocSchool) {
  const w = doc.internal.pageSize.getWidth();
  const s = card.student;
  frame(doc);
  watermark(doc, lib, img, 120);
  banner(doc, img, school, "STUDENT REPORT CARD", `Academic year ${card.academicYear}`, `${s.grade}${s.section}`);

  // Student details
  const y0 = 51;
  doc.setFillColor(...TINT);
  doc.setDrawColor(...BLUE);
  doc.setLineWidth(0.4);
  doc.roundedRect(14, y0, w - 28, 25, 2, 2, "FD");
  const fields: [string, string][] = [
    ["Full name", s.full_name],
    ["Student ID", s.student_code],
    ["Sex", genderLabel(s.gender)],
    ["Grade & section", `Grade ${s.grade} - Section ${s.section}`],
    ["Stream", s.grade >= 11 ? streamLabel(s.stream) : "General"],
    ["Class size", `${card.classSize} students`],
  ];
  fields.forEach(([label, value], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 19 + col * ((w - 28) / 2);
    const y = y0 + 7 + row * 7;
    doc.setTextColor(...MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(label.toUpperCase(), x, y);
    doc.setTextColor(...INK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text(value, x + 30, y);
  });

  // Subjects
  lib.autoTable(doc, {
    startY: y0 + 30,
    margin: { left: 14, right: 14 },
    theme: "grid",
    head: [["No", "Subject", "Semester I", "Semester II", "Annual", "Grade"]],
    body: card.subjects.map((r, i) => [String(i + 1), r.name, n(r.sem1), n(r.sem2), n(r.annual), r.letter ?? "-"]),
    foot: [["", "Total", n(card.sem1.total), n(card.sem2.total), n(card.annual.total), ""], ["", "Average", n(card.sem1.average, 2), n(card.sem2.average, 2), n(card.annual.average, 2), ""]],
    styles: { font: "helvetica", fontSize: 9, cellPadding: 1.8, lineColor: NAVY, lineWidth: 0.2, textColor: INK, halign: "center" },
    headStyles: { fillColor: BLUE, textColor: [255, 255, 255], fontStyle: "bold" },
    footStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: ROW },
    columnStyles: { 0: { cellWidth: 11 }, 1: { halign: "left", fontStyle: "bold" }, 5: { cellWidth: 18 } },
    didParseCell: (d) => {
      if (d.section !== "body" || d.column.index < 2 || d.column.index > 4) return;
      const v = Number(d.cell.raw);
      if (!Number.isNaN(v) && v < card.passMark) {
        d.cell.styles.textColor = RED;
        d.cell.styles.fontStyle = "bold";
      }
    },
  });

  // Summary
  let y = finalY(doc) + 6;
  const bw = (w - 28 - 9) / 4;
  const rank = card.annual.rank;
  statBox(doc, 14, y, bw, "Annual total", n(card.annual.total), `Sem I ${n(card.sem1.total)} - Sem II ${n(card.sem2.total)}`);
  statBox(doc, 14 + (bw + 3), y, bw, "Annual average", n(card.annual.average, 2), `Sem I ${n(card.sem1.average, 2)} - Sem II ${n(card.sem2.average, 2)}`);
  statBox(doc, 14 + (bw + 3) * 2, y, bw, "Rank", rank ? `${ordinal(rank)}` : "-", `out of ${card.classSize}`);
  statBox(
    doc, 14 + (bw + 3) * 3, y, bw, "Result",
    card.pass === null ? "-" : card.pass ? "PASSED" : "FAILED",
    `Pass mark ${card.passMark}`,
    card.pass === null ? undefined : card.pass ? GREEN : RED,
  );
  y += 30;
  doc.setTextColor(...MUTED);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.text(`Grading scale: ${GRADE_SCALE.map((g) => `${g.letter} >= ${g.min}`).join("   ")}`, w / 2, y, { align: "center" });

  signatures(doc, Math.max(y + 18, 262), school);
  footer(doc, `${school.name} - Official report card - Generated ${new Date().toLocaleDateString()}`);
}

function pdfName(card: ReportCard) {
  return `${card.student.student_code} ${card.student.full_name}`.replace(/[\\/:*?"<>|]/g, "-") + ".pdf";
}

export async function reportCardsPdf(cards: ReportCard[], school: DocSchool): Promise<Blob> {
  const [lib, img] = await Promise.all([libs(), loadImages()]);
  const doc = new lib.jsPDF({ unit: "mm", format: "a4", compress: true });
  cards.forEach((c, i) => {
    if (i > 0) doc.addPage();
    drawReportCard(doc, lib, img, c, school);
  });
  return doc.output("blob");
}

/** One PDF per student, in a folder per class. */
export async function reportCardsZip(
  groups: { folder: string; cards: ReportCard[] }[],
  school: DocSchool,
  onProgress?: (done: number, total: number) => void,
): Promise<Blob> {
  const [lib, img, { default: JSZip }] = await Promise.all([libs(), loadImages(), import("jszip")]);
  const zip = new JSZip();
  const total = groups.reduce((a, g) => a + g.cards.length, 0);
  let done = 0;
  for (const g of groups) {
    const folder = groups.length > 1 ? zip.folder(g.folder)! : zip;
    for (const c of g.cards) {
      const doc = new lib.jsPDF({ unit: "mm", format: "a4", compress: true });
      drawReportCard(doc, lib, img, c, school);
      folder.file(pdfName(c), doc.output("arraybuffer"));
      done++;
      if (done % 10 === 0) {
        onProgress?.(done, total);
        await new Promise((r) => setTimeout(r, 0));
      }
    }
  }
  onProgress?.(total, total);
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}

const PERIOD_TITLE: Record<Period, string> = { "1": "SEMESTER I", "2": "SEMESTER II", annual: "ANNUAL" };

export async function rosterPdf(input: {
  rows: ClassResultRow[];
  subjects: Subject[];
  period: Period;
  grade: number;
  section: string;
  stream: string | null;
  academicYear: string;
  passMark: number;
  school: DocSchool;
}): Promise<Blob> {
  const { rows, subjects, period, passMark, school } = input;
  const [lib, img] = await Promise.all([libs(), loadImages()]);
  const doc = new lib.jsPDF({ unit: "mm", format: "a4", orientation: "landscape", compress: true });
  const w = doc.internal.pageSize.getWidth();
  const pick = (r: ClassResultRow) =>
    period === "1" ? { ...r.sem1, rank: r.rank.sem1 } : period === "2" ? { ...r.sem2, rank: r.rank.sem2 } : { ...r.annual, rank: r.rank.annual };
  const cell = (r: ClassResultRow, id: string) => {
    const c = r.cells[id];
    return c ? (period === "1" ? c.sem1 : period === "2" ? c.sem2 : c.annual) : null;
  };
  const passOf = (r: ClassResultRow) => {
    const a = pick(r).average;
    return a === null ? null : a >= passMark;
  };

  frame(doc);
  watermark(doc, lib, img, 130);
  banner(
    doc, img, school, `${PERIOD_TITLE[period]} MASTER ROSTER`,
    `${classLabel(input.grade, input.section, input.stream).replace(/·/g, "-")} - Academic year ${input.academicYear}`,
    `${input.grade}${input.section}`,
  );
  const subjectCols = subjects.length;
  lib.autoTable(doc, {
    startY: 50,
    margin: { left: 13, right: 13, top: 16, bottom: 16 },
    theme: "grid",
    head: [["No", "ID", "Full name", "Sex", ...subjects.map((s) => s.code), "Total", "Avg", "Rank", "Remark"]],
    body: rows.map((r, i) => {
      const p = pick(r);
      const pass = passOf(r);
      return [
        String(i + 1), r.student.student_code, r.student.full_name, r.student.gender,
        ...subjects.map((s) => n(cell(r, s.id))),
        n(p.total), n(p.average, 2), p.rank ? String(p.rank) : "-", pass === null ? "-" : pass ? "Pass" : "Fail",
      ];
    }),
    styles: { font: "helvetica", fontSize: 7.2, cellPadding: 1.1, lineColor: NAVY, lineWidth: 0.15, textColor: INK, halign: "center", valign: "middle" },
    headStyles: { fillColor: BLUE, textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: ROW },
    columnStyles: { 0: { cellWidth: 7 }, 1: { cellWidth: 17 }, 2: { halign: "left", cellWidth: 44 }, 3: { cellWidth: 7 } },
    didParseCell: (d) => {
      if (d.section !== "body") return;
      const col = d.column.index;
      const total = 4 + subjectCols;
      if (col >= 4 && col < total) {
        const v = Number(d.cell.raw);
        if (!Number.isNaN(v) && v < passMark) {
          d.cell.styles.textColor = RED;
          d.cell.styles.fontStyle = "bold";
        }
      }
      if (col >= total) d.cell.styles.fontStyle = "bold";
      if (col === total + 2 && ["1", "2", "3"].includes(String(d.cell.raw))) {
        d.cell.styles.fillColor = GOLD;
        d.cell.styles.textColor = [255, 255, 255];
      }
      if (col === total + 3) d.cell.styles.textColor = d.cell.raw === "Pass" ? GREEN : d.cell.raw === "Fail" ? RED : INK;
    },
    didDrawPage: () => {
      if (doc.getCurrentPageInfo().pageNumber > 1) frame(doc);
    },
  });

  let y = finalY(doc) + 6;
  if (y > 165) {
    doc.addPage();
    frame(doc);
    y = 20;
  }
  const m = rows.filter((r) => r.student.gender === "M");
  const f = rows.filter((r) => r.student.gender === "F");
  const passed = (list: ClassResultRow[]) => list.filter((r) => passOf(r) === true).length;
  lib.autoTable(doc, {
    startY: y,
    margin: { left: 13 },
    tableWidth: 80,
    theme: "grid",
    head: [["", "Male", "Female", "Total"]],
    body: [
      ["Enrolled", String(m.length), String(f.length), String(rows.length)],
      ["Passed", String(passed(m)), String(passed(f)), String(passed(rows))],
      ["Failed", String(m.length - passed(m)), String(f.length - passed(f)), String(rows.length - passed(rows))],
    ],
    styles: { fontSize: 7.5, cellPadding: 1.2, lineColor: NAVY, lineWidth: 0.15, halign: "center" },
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255] },
    columnStyles: { 0: { halign: "left", fontStyle: "bold" } },
  });
  doc.setPage(doc.getNumberOfPages());
  const sigDoc = doc;
  const sx = 100;
  const span = (w - sx - 15) / 3;
  ["Homeroom teacher", "Registrar", "Principal"].forEach((label, i) => {
    const x = sx + i * span + 5;
    const name = label === "Registrar" ? school.registrar : label === "Principal" ? school.principal : "";
    sigDoc.setDrawColor(...NAVY);
    sigDoc.setLineWidth(0.3);
    sigDoc.line(x, y + 16, x + span - 10, y + 16);
    sigDoc.setTextColor(...INK);
    sigDoc.setFont("helvetica", "bold");
    sigDoc.setFontSize(8);
    if (name) sigDoc.text(name, x + (span - 10) / 2, y + 20, { align: "center" });
    sigDoc.setFont("helvetica", "normal");
    sigDoc.setFontSize(6.5);
    sigDoc.setTextColor(...MUTED);
    sigDoc.text(label.toUpperCase(), x + (span - 10) / 2, y + (name ? 24 : 20.5), { align: "center" });
  });
  for (let p = 1; p <= doc.getNumberOfPages(); p++) {
    doc.setPage(p);
    footer(doc, `${school.name} - Pass mark ${passMark} - Page ${p} of ${doc.getNumberOfPages()} - Generated ${new Date().toLocaleDateString()}`);
  }
  return doc.output("blob");
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export const reportCardFileName = pdfName;
