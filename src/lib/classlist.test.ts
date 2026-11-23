import { describe, expect, it } from "vitest";
import { assignCodes, codePrefix, parseClassSheets } from "./classlist";

const sheet = (name: string, title: string, rows: unknown[][]) => ({
  name,
  rows: [[null, null, null, null, null, title], ["No.", "Name", "F.name", "G.F name", "Sex", "Age"], ...rows, [null, "M", "F", "Total"]],
});

describe("class list import", () => {
  it("reads grade and section from the sheet title and joins the three names", () => {
    const { rows, errors } = parseClassSheets([sheet("10 A", "GRADE 10A     Year 2019 E.C", [[1, "Abdi", "Dejene", "Daba", "M", 15]])], "2019 E.C.");
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ full_name: "Abdi Dejene Daba", gender: "M", grade: 10, section: "A", stream: null });
  });

  it("puts Grade 11–12 section C in Social and sections A, B in Natural", () => {
    const { rows } = parseClassSheets(
      [
        sheet("11 C", "GRADE 11C", [[1, "Hamdi", "Mohamed", "Edris", "M", 17]]),
        sheet("12 B", "GRADE 12B", [[1, "Abdi", "Bekele", "Geremew", "M", 18]]),
      ],
      "2019 E.C.",
    );
    expect(rows.map((r) => r.stream)).toEqual(["social", "natural"]);
  });

  it("continues the BH19- sequence and reuses codes of students already registered", () => {
    const parsed = parseClassSheets(
      [sheet("9A", "GRADE 9A", [[1, "Abdi", "Dadi", "Tolesa", "M", 15], [2, "Abel", "Argachew", "Abebe", "M", 15]])],
      "2019 E.C.",
    ).rows;
    const out = assignCodes(parsed, [{ student_code: "BH19-0007", full_name: "Abel Argachew Abebe", grade: 9, section: "A" }], codePrefix("2019 E.C."));
    expect(out.map((r) => r.student_code)).toEqual(["BH19-0008", "BH19-0007"]);
  });
});
