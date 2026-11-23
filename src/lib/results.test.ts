import { describe, expect, it } from "vitest";
import { publishedMarks } from "./results";
import type { Mark } from "./school";

const mark = (grade: number, semester: number): Mark => ({
  id: `${grade}-${semester}`, student_id: "s", subject_id: "x", grade, semester, academic_year: "", score: 70, updated_at: "",
});

describe("students only see approved results", () => {
  const marks = [mark(10, 1), mark(10, 2), mark(9, 1), mark(9, 2)];
  it("hides the current grade's semesters the admin has not approved", () => {
    expect(publishedMarks(marks, 10, { sem1: true, sem2: false }).map((m) => m.id)).toEqual(["10-1", "9-1", "9-2"]);
  });
  it("shows nothing from the current grade when no semester is approved", () => {
    expect(publishedMarks(marks, 10, { sem1: false, sem2: false }).map((m) => m.id)).toEqual(["9-1", "9-2"]);
  });
});
