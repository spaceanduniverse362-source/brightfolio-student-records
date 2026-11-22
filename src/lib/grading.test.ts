import { describe, expect, it } from "vitest";
import {
  annualAverage,
  cumulativeAverage,
  gpa,
  isPass,
  letterGrade,
  rankBy,
  semesterSummary,
  annualSubjectScore,
} from "./grading";

describe("grading rules", () => {
  it("passes a student whose average is exactly the 50 pass mark", () => {
    expect(isPass(50, 50)).toBe(true);
    expect(isPass(49.99, 50)).toBe(false);
  });

  it("maps scores onto the 4.0 letter scale", () => {
    expect(letterGrade(92)).toEqual({ letter: "A+", points: 4 });
    expect(letterGrade(80)).toEqual({ letter: "A-", points: 3.75 });
    expect(letterGrade(50)).toEqual({ letter: "C", points: 2 });
    expect(letterGrade(39)).toEqual({ letter: "F", points: 0 });
  });

  it("totals and averages only the subjects that have a score", () => {
    expect(semesterSummary([80, 70, null])).toEqual({ total: 150, average: 75, count: 2 });
  });

  it("annual subject score is the mean of both semesters", () => {
    expect(annualSubjectScore({ sem1: 70, sem2: 81 })).toBe(75.5);
    expect(annualSubjectScore({ sem1: 70, sem2: null })).toBe(70);
  });

  it("annual and cumulative averages average their parts", () => {
    expect(annualAverage(70, 80)).toBe(75);
    expect(cumulativeAverage([70, 80, 90, 60])).toBe(75);
  });

  it("GPA averages grade points of annual subject results", () => {
    expect(gpa([95, 72])).toBe(3.5);
  });

  it("tied students share a rank and the next rank is skipped", () => {
    const a = { s: 90 }, b = { s: 85 }, c = { s: 85 }, d = { s: 70 }, e = { s: null };
    const ranks = rankBy([a, b, c, d, e], (x) => x.s);
    expect([ranks.get(a), ranks.get(b), ranks.get(c), ranks.get(d), ranks.get(e)]).toEqual([
      1, 2, 2, 4, null,
    ]);
  });
});
