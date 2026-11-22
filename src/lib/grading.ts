/** Pure grading rules shared by mark sheets, rosters and transcripts. */

export type LetterGrade = {
  letter: string;
  points: number;
};

/** Ethiopian secondary 4.0 scale. */
const SCALE: { min: number; letter: string; points: number }[] = [
  { min: 90, letter: "A+", points: 4.0 },
  { min: 85, letter: "A", points: 4.0 },
  { min: 80, letter: "A-", points: 3.75 },
  { min: 75, letter: "B+", points: 3.5 },
  { min: 70, letter: "B", points: 3.0 },
  { min: 65, letter: "B-", points: 2.75 },
  { min: 60, letter: "C+", points: 2.5 },
  { min: 50, letter: "C", points: 2.0 },
  { min: 45, letter: "C-", points: 1.75 },
  { min: 40, letter: "D", points: 1.0 },
  { min: 0, letter: "F", points: 0 },
];

export const GRADE_SCALE = SCALE;

export function letterGrade(score: number): LetterGrade {
  const row = SCALE.find((r) => score >= r.min) ?? SCALE[SCALE.length - 1]!;
  return { letter: row.letter, points: row.points };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function mean(values: (number | null | undefined)[]): number | null {
  const v = values.filter((x): x is number => typeof x === "number" && !Number.isNaN(x));
  if (v.length === 0) return null;
  return round2(v.reduce((a, b) => a + b, 0) / v.length);
}

export function sum(values: (number | null | undefined)[]): number | null {
  const v = values.filter((x): x is number => typeof x === "number" && !Number.isNaN(x));
  if (v.length === 0) return null;
  return round2(v.reduce((a, b) => a + b, 0));
}

export function isPass(average: number | null, passMark: number): boolean | null {
  if (average === null) return null;
  return average >= passMark;
}

/**
 * Competition ranking: equal averages share a rank and the next rank is skipped
 * (e.g. 1, 2, 2, 4). Entries without an average are unranked (null).
 */
export function rankBy<T>(items: T[], score: (item: T) => number | null): Map<T, number | null> {
  const result = new Map<T, number | null>();
  const scored = items
    .map((item) => ({ item, s: score(item) }))
    .filter((x): x is { item: T; s: number } => x.s !== null)
    .sort((a, b) => b.s - a.s);
  let lastScore: number | null = null;
  let lastRank = 0;
  scored.forEach((x, i) => {
    if (lastScore === null || x.s !== lastScore) {
      lastRank = i + 1;
      lastScore = x.s;
    }
    result.set(x.item, lastRank);
  });
  for (const item of items) if (!result.has(item)) result.set(item, null);
  return result;
}

export type SubjectScores = { sem1: number | null; sem2: number | null };

/** Annual subject result: mean of the semesters that have a score. */
export function annualSubjectScore(s: SubjectScores): number | null {
  return mean([s.sem1, s.sem2]);
}

/** Semester summary for one student: total, average across subjects with a score. */
export function semesterSummary(scores: (number | null)[]) {
  return { total: sum(scores), average: mean(scores), count: scores.filter((x) => x !== null).length };
}

/** Annual average = mean of the two semester averages. */
export function annualAverage(sem1Avg: number | null, sem2Avg: number | null): number | null {
  return mean([sem1Avg, sem2Avg]);
}

/** Cumulative 4-year average = mean of the annual averages that exist. */
export function cumulativeAverage(annualAverages: (number | null)[]): number | null {
  return mean(annualAverages);
}

/** GPA = mean of grade points for every annual subject result. */
export function gpa(annualSubjectScores: (number | null)[]): number | null {
  const pts = annualSubjectScores
    .filter((x): x is number => x !== null)
    .map((x) => letterGrade(x).points);
  return mean(pts);
}

export function graduationRemark(average: number | null, passMark: number): string {
  if (average === null) return "Incomplete record";
  if (average < passMark) return "Not promoted";
  if (average >= 90) return "Graduated with Great Distinction";
  if (average >= 80) return "Graduated with Distinction";
  if (average >= 70) return "Graduated with Very Good standing";
  return "Graduated";
}
