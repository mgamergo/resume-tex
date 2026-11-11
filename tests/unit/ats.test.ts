import { test, expect } from "bun:test";
import { analyzePdf, keywordsFor, type PdfText } from "../../lib/core/ats";
import { parseDateRanges, parseFields } from "../../lib/core/pdf-parser";
const text =
  "Alex Morgan\nalex@example.com | (415) 555-0100 | github.com/alex\nExperience\nSoftware Engineer Jan 2022 – Present\nExample Labs\nBuilt a TypeScript dashboard for 120 teammates.\nEducation\nUniversity of California\nB.S. Computer Science\nSep 2017 – May 2021\nSkills\nTypeScript, React, Node.js, PostgreSQL, Docker";
const pdf: PdfText = {
  text,
  words: [],
  pages: 1,
  columns: false,
  lowTextPages: [],
};
test("required heading context survives bullet lines and technical dots; synonyms and missing skills are explainable", () => {
  const keywords = keywordsFor(
    text,
    "Requirements\n- React\n- TypeScript\n- Node.js\n- Kubernetes\nNice to have\n- Docker\n- Postgres",
  );
  expect(keywords.find((k) => k.term === "node.js")?.required).toBe(true);
  expect(keywords.find((k) => k.term === "react")?.required).toBe(true);
  expect(keywords.find((k) => k.term === "docker")?.required).toBe(false);
  expect(keywords.find((k) => k.term === "kubernetes")?.method).toBe("missing");
  expect(keywords.find((k) => k.term === "postgresql")?.matched).toBe(true);
  expect(keywords.some((k) => k.term === "javascript")).toBe(false);
  const synonym = keywordsFor(
    "Postgres k8s",
    "Required PostgreSQL and Kubernetes",
  );
  expect(synonym.find((k) => k.term === "postgresql")?.method).toBe("synonym");
  expect(synonym.find((k) => k.term === "kubernetes")?.method).toBe("synonym");
});
test("mixed date formats and reversed ranges are detected separately from recognizable dates", () => {
  const ranges = parseDateRanges(
    "Jan 2022 – Present; 2017 - 2021; 06/2025 - 01/2024",
  );
  expect(ranges).toHaveLength(3);
  expect(new Set(ranges.map((r) => r.style)).size).toBe(3);
  expect(ranges[2].reversed).toBe(true);
  const report = analyzePdf(
    { ...pdf, text: text + "\n06/2025 - 01/2024" },
    "",
    "",
    "digest",
    "artifact",
  );
  expect(report.findings.find((f) => f.id === "dates")?.level).toBe("warning");
});
test("structured fields preserve raw evidence, and score uses PDF data rather than source keyword stuffing", () => {
  const fields = parseFields(pdf, {
    experience:
      "Software Engineer Jan 2022 – Present\nExample Labs\nBuilt a dashboard",
    education:
      "University of California\nB.S. Computer Science\nSep 2017 – May 2021",
    skills: "TypeScript, React, Node.js, PostgreSQL, Docker",
  });
  expect(fields.contact.email).toBe("alex@example.com");
  expect(fields.experience[0].role).toBe("Software Engineer");
  expect(fields.education[0].institution).toBe("University of California");
  expect(fields.skills).toContain("React");
  expect(fields.dates).toHaveLength(2);
  const first = analyzePdf(
    pdf,
    "% Kubernetes never rendered",
    "Required Kubernetes",
    "digest",
    "artifact",
  );
  expect(first.keywords.find((k) => k.term === "kubernetes")?.matched).toBe(
    false,
  );
  const second = analyzePdf(
    { ...pdf, text: text + "\nKubernetes" },
    "",
    "Required Kubernetes",
    "digest",
    "artifact",
  );
  expect(second.score).toBeGreaterThan(first.score);
  expect(first.digest).toBe("digest");
  expect(first.artifact).toBe("artifact");
});
test("geometry/nonselectable and extracted ligature issues create bounded warnings", () => {
  const report = analyzePdf(
    { ...pdf, text: text + "\nﬁnancial", columns: true, lowTextPages: [1] },
    "\\begin{tabular}{ll}",
    "",
    "d",
    "a",
  );
  expect(report.findings.find((f) => f.id === "columns")?.level).toBe(
    "warning",
  );
  expect(report.findings.find((f) => f.id === "selectable")?.level).toBe(
    "warning",
  );
  expect(
    report.findings.filter((f) => f.id.startsWith("advisory")).length,
  ).toBeGreaterThanOrEqual(2);
});
test("employment dates do not become phone contacts and two degrees retain separate evidence", () => {
  const input = {
    ...pdf,
    text: "Alex Morgan\nalex@example.com\nExperience\nEngineer 2020--2024\nEducation\nExample University\nB.S. Computer Science\n2014 - 2018\nExample Institute\nM.S. Computer Science\n2018 - 2020",
  };
  const parsed = parseFields(input, {
    experience: "Engineer 2020--2024",
    education:
      "Example University\nB.S. Computer Science\n2014 - 2018\nExample Institute\nM.S. Computer Science\n2018 - 2020",
    skills: "",
  });
  expect(parsed.contact.phone).toBeNull();
  expect(parsed.education).toHaveLength(2);
  expect(parsed.education[1].institution).toBe("Example Institute");
  expect(parsed.education[1].dates).toBe("2018 - 2020");
});

test.each(["Nice to have", "Nice-to-have", "Nice‑to‑haves:"])(
  "preferred heading %s ends required-skill context",
  (heading) => {
    const keywords = keywordsFor(
      "React Docker",
      `Requirements\nReact\n${heading}\nDocker`,
    );
    expect(keywords.find((keyword) => keyword.term === "react")?.required).toBe(
      true,
    );
    expect(
      keywords.find((keyword) => keyword.term === "docker")?.required,
    ).toBe(false);
    expect(keywords.map((keyword) => keyword.term)).not.toContain(
      "nice-to-have",
    );
    expect(keywords.map((keyword) => keyword.term)).not.toContain(
      "nice-to-haves",
    );
  },
);
