import type { PdfText } from "./ats";
export type DateRange = {
  raw: string;
  start: string;
  end: string;
  style: "month-name" | "numeric" | "year-only";
  reversed: boolean;
};
export type ParsedFields = {
  contact: {
    name: string;
    email: string | null;
    phone: string | null;
    links: string[];
    location: string | null;
  };
  experience: {
    role: string | null;
    employer: string | null;
    dates: string | null;
    evidence: string;
    confidence: "medium" | "low";
  }[];
  education: {
    institution: string | null;
    degree: string | null;
    dates: string | null;
    evidence: string;
    confidence: "medium" | "low";
  }[];
  skills: string[];
  dates: DateRange[];
  limitations: string[];
};
const month =
  "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";
const named = `${month}\\s+(?:19|20)\\d{2}`;
const numeric = "(?:0?[1-9]|1[0-2])[/.](?:19|20)\\d{2}";
const year = "(?:19|20)\\d{2}";
const date = `(?:${named}|${numeric}|${year})`;
const rangePattern = new RegExp(
  `(${date})\\s*(?:--?|–|—|to)\\s*(${date}|Present|Current)`,
  "gi",
);
function dateValue(value: string) {
  if (/present|current/i.test(value)) return Infinity;
  const numericMatch = value.match(/^(\d{1,2})[/.](\d{4})$/);
  if (numericMatch)
    return Number(numericMatch[2]) * 12 + Number(numericMatch[1]);
  const yearValue = Number(value.match(/\d{4}/)?.[0] ?? 0);
  const months = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ];
  const index = months.indexOf(value.slice(0, 3).toLowerCase());
  return yearValue * 12 + (index < 0 ? 1 : index + 1);
}
export function parseDateRanges(text: string): DateRange[] {
  return [...text.matchAll(rangePattern)].map((match) => ({
    raw: match[0],
    start: match[1],
    end: match[2],
    style: /^[A-Za-z]/.test(match[1])
      ? "month-name"
      : /[/.]/.test(match[1])
        ? "numeric"
        : "year-only",
    reversed: dateValue(match[1]) > dateValue(match[2]),
  }));
}
export function parseFields(
  pdf: PdfText,
  sections: { experience: string; education: string; skills: string },
): ParsedFields {
  const lines = pdf.text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const experienceLines = sections.experience
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const experience: ParsedFields["experience"] = [];
  for (let index = 0; index < experienceLines.length; index++) {
    const line = experienceLines[index];
    const ranges = parseDateRanges(line);
    if (!ranges.length) continue;
    const raw = ranges[0].raw;
    const before = line.slice(0, line.indexOf(raw)).replace(/[|,\s]+$/g, "");
    const after = line
      .slice(line.indexOf(raw) + raw.length)
      .replace(/^[|,\s]+/g, "");
    const previous = experienceLines[index - 1] ?? "";
    const previousPrevious = experienceLines[index - 2] ?? "";
    const next = experienceLines[index + 1] ?? "";
    const rolePattern =
      /engineer|developer|manager|designer|analyst|director|specialist|consultant|assistant|lead|intern/i;
    const bulletPattern =
      /^(?:[•○-])|\b(?:built|reduced|maintained|developed|designed|led|managed)\b/i;
    const title = before || (rolePattern.test(after) ? after : previous);
    const pieces = title.split(/\s*[|,]\s*/);
    let role: string | null = null;
    let employer: string | null = null;
    if (pieces.length > 1 && pieces.some((piece) => rolePattern.test(piece))) {
      role = pieces.find((piece) => rolePattern.test(piece)) ?? null;
      employer = pieces.find((piece) => piece !== role) ?? null;
    } else if (rolePattern.test(title)) {
      role = title;
      employer = before
        ? previous &&
          !rolePattern.test(previous) &&
          !bulletPattern.test(previous)
          ? previous
          : !bulletPattern.test(next)
            ? next
            : null
        : null;
    } else if (rolePattern.test(previousPrevious)) {
      role = previousPrevious;
      employer = previous;
    } else {
      role = title || null;
    }
    experience.push({
      role,
      employer,
      dates: raw,
      evidence: experienceLines
        .slice(
          Math.max(0, index - 1),
          Math.min(experienceLines.length, index + 4),
        )
        .join("\n"),
      confidence: role && employer ? "medium" : "low",
    });
  }
  if (!experience.length && sections.experience)
    experience.push({
      role: null,
      employer: null,
      dates: null,
      evidence: sections.experience,
      confidence: "low",
    });
  const education: ParsedFields["education"] = [];
  const educationLines = sections.education
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const institutionIndexes = educationLines.flatMap((line, index) =>
    /(?:University|College|Institute|School)/i.test(line) ? [index] : [],
  );
  for (const [position, index] of institutionIndexes.entries()) {
    const evidence = educationLines
      .slice(index, institutionIndexes[position + 1] ?? educationLines.length)
      .join("\n");
    const institution = educationLines[index].replace(rangePattern, "").trim();
    const degree =
      evidence
        .match(
          /[^\n]*(?:B\.\s?S\.|M\.\s?S\.|Bachelor|Master|Ph\.?D|degree)[^\n]*/i,
        )?.[0]
        ?.replace(rangePattern, "")
        .trim() ?? null;
    education.push({
      institution,
      degree,
      dates: parseDateRanges(evidence)[0]?.raw ?? null,
      evidence,
      confidence: degree ? "medium" : "low",
    });
  }
  if (!education.length && sections.education)
    education.push({
      institution: null,
      degree: null,
      dates: parseDateRanges(sections.education)[0]?.raw ?? null,
      evidence: sections.education,
      confidence: "low",
    });
  const firstSection = lines.findIndex((line) =>
    /^(?:experience|education|skills|projects|summary)$/i.test(line),
  );
  const headerLines = lines.slice(0, firstSection > 0 ? firstSection : 8);
  const header = headerLines.join("\n");
  const phone =
    (header.match(/\+?\(?\d[\d ()~-]{7,}\d/g) ?? []).find((candidate) => {
      const digits = candidate.replace(/\D/g, "");
      return (
        digits.length >= 10 &&
        digits.length <= 15 &&
        !parseDateRanges(candidate).length
      );
    }) ?? null;
  const contact = {
    name: (lines[0] ?? "").split("|")[0].replace(/\s+/g, " ").trim(),
    email: header.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i)?.[0] ?? null,
    phone,
    links: [
      ...new Set(
        header.match(
          /(?:https?:\/\/)?(?:linkedin\.com|github\.com|[a-z0-9-]+\.(?:dev|io))\/[\w/-]+/gi,
        ) ?? [],
      ),
    ],
    location:
      header
        .match(/(?:^|[|\n])\s*([A-Z][A-Za-z .]+,\s*[A-Z]{2})\b/)?.[1]
        ?.trim() ?? null,
  };
  const skills = [
    ...new Set(
      sections.skills
        .replace(
          /\b(?:Languages|Frameworks|Tools|Technologies|Libraries)\s*:/gi,
          "",
        )
        .split(/[,\n|•]+/)
        .map((skill) => skill.trim())
        .filter(
          (skill) =>
            skill &&
            skill.length < 70 &&
            !/^(?:Languages|Frameworks|Tools|Technologies|Libraries)$/i.test(
              skill,
            ),
        ),
    ),
  ];
  return {
    contact,
    experience,
    education,
    skills,
    dates: parseDateRanges(pdf.text),
    limitations: [
      "Deterministic best-effort fields with raw evidence; ambiguous titles and column reading order require review.",
      "PDF text does not reveal whether a vendor uses the same extraction or fields. No employer-specific parser was queried.",
    ],
  };
}
