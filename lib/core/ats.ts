import { parseFields, type ParsedFields } from "./pdf-parser";
export type PdfWord = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
};
export type PdfText = {
  text: string;
  pages: number;
  words: PdfWord[];
  columns: boolean;
  lowTextPages: number[];
};
export type Finding = {
  id: string;
  level: "pass" | "warning";
  title: string;
  detail: string;
  fix?: "sections" | "impact" | "columns";
};
export type Keyword = {
  term: string;
  required: boolean;
  matched: boolean;
  method: "exact" | "synonym" | "stem" | "missing";
  weight: number;
};
export type AtsReport = {
  digest: string;
  artifact: string;
  score: number;
  breakdown: {
    name: string;
    earned: number;
    possible: number;
    detail: string;
  }[];
  keywords: Keyword[];
  findings: Finding[];
  parsed: ParsedFields;
  sections: { experience: string; education: string; skills: string };
  pdf: PdfText;
  wordCount: number;
  quantifiedBullets: number;
  jobDescription: string;
};
const skills = [
  "typescript",
  "javascript",
  "react",
  "node.js",
  "next.js",
  "python",
  "java",
  "sql",
  "postgresql",
  "mysql",
  "aws",
  "docker",
  "kubernetes",
  "git",
  "rest api",
  "graphql",
  "css",
  "html",
  "accessibility",
  "testing",
  "ci/cd",
  "leadership",
  "communication",
  "agile",
  "data analysis",
  "machine learning",
  "excel",
  "figma",
  "sales",
  "marketing",
  "project management",
  "customer service",
  "linux",
  "azure",
  "gcp",
  "rust",
  "go",
  "c++",
  "c#",
];
const synonyms: Record<string, string[]> = {
  javascript: ["js"],
  typescript: ["ts"],
  "node.js": ["nodejs", "node js"],
  "next.js": ["nextjs", "next js"],
  postgresql: ["postgres"],
  aws: ["amazon web services"],
  gcp: ["google cloud"],
  kubernetes: ["k8s"],
  "rest api": ["restful", "rest apis"],
  testing: ["tests", "automated tests"],
  "ci/cd": ["continuous integration", "continuous delivery"],
  communication: ["communicate", "communicating"],
  leadership: ["led", "mentored", "managed"],
};
const stop = new Set(
  "the and for with that this you your are our will have has from can all into who what how but more must required preferred experience years year work working role team using use strong skills ability including such or of to in a an on is be we as at by it not about through understanding knowledge looking join responsibilities qualifications requirements candidates candidate job position company benefits excellent good proven new development software engineer engineering ideal well demonstrated related degree equivalent plus minimum familiar familiarity proficient proficiency design build develop maintain needed should seeking successful passion support technical technology technologies systems services applications tools projects business based includes across within other also least highly bachelor relevant ensure demonstrate building developing teams provide preferred requirement requirement nice need expertise apply professional world impact product products solutions opportunity equal remote salary time location employment description level hands hands-on stakeholders people help make day looking track record environment deliver collaborate collaboration full stack computer science manage management designing implementing implementing following".split(
    /\s+/,
  ),
);
export function stem(term: string) {
  return term
    .toLowerCase()
    .replace(/(?:ing|ed|es|s)$/u, "")
    .replace(/(?:tion|ment)$/u, "");
}
const normalize = (text: string) => text.toLowerCase().replace(/[‐‑–—]/g, "-");
function contains(text: string, term: string) {
  return new RegExp(
    `(^|[^a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`,
    "i",
  ).test(text);
}
export function keywordsFor(text: string, jd: string): Keyword[] {
  if (!jd.trim()) return [];
  let requirementContext = false;
  const documents = jd
    .split(/\n|(?<=[.!?])\s+(?=[A-Z])/)
    .map((line) => {
      const lower = normalize(line.trim());
      if (
        /^(?:requirements|qualifications|must have|required|minimum qualifications|essential skills)\s*:?$/.test(
          lower,
        )
      )
        requirementContext = true;
      if (
        /^(?:nice to have|preferred|preferred qualifications|bonus|optional)\s*:?$/.test(
          lower,
        )
      )
        requirementContext = false;
      return (requirementContext ? "required " : "") + lower;
    })
    .filter((line) => line.trim());
  const tokens = documents.map(
    (line) => line.match(/[a-z][a-z0-9+#.-]*/g) ?? [],
  );
  const avg =
    tokens.reduce((sum, terms) => sum + terms.length, 0) /
    Math.max(1, tokens.length);
  const candidates = new Set(
    skills.filter(
      (skill) =>
        contains(jd, skill) ||
        (synonyms[skill] ?? []).some((alias) => contains(jd, alias)),
    ),
  );
  const frequency = new Map<string, number>();
  for (const list of tokens)
    for (const token of list)
      if (
        token.length > 3 &&
        !stop.has(token) &&
        !skills.some((skill) => skill.includes(token))
      )
        frequency.set(token, (frequency.get(token) ?? 0) + 1);
  for (const [token] of [...frequency].sort((a, b) => b[1] - a[1]).slice(0, 18))
    candidates.add(token);
  const lower = normalize(text);
  const sourceTerms = new Set(
    (lower.match(/[a-z][a-z0-9+#.-]*/g) ?? []).map(stem),
  );
  return [...candidates]
    .map((term) => {
      const relevant = documents.filter(
        (line) =>
          contains(line, term) ||
          (synonyms[term] ?? []).some((alias) => contains(line, alias)),
      );
      const required =
        relevant.some((line) =>
          /\b(required|must|minimum|essential|need|requirements)\b/.test(line),
        ) &&
        !relevant.every((line) =>
          /\b(preferred|nice|bonus|plus|optional)\b/.test(line),
        );
      const df = relevant.length;
      const idf = Math.log(1 + (documents.length - df + 0.5) / (df + 0.5));
      const bm25 = tokens.reduce((sum, list, index) => {
        const tf =
          list.filter((token) => stem(token) === stem(term)).length ||
          (contains(documents[index], term) ? 1 : 0);
        return (
          sum +
          (idf * (tf * 2.2)) /
            (tf + 1.2 * (0.25 + (0.75 * list.length) / Math.max(avg, 1)))
        );
      }, 0);
      const exact = contains(lower, term);
      const synonym = (synonyms[term] ?? []).some((alias) =>
        contains(lower, alias),
      );
      const stemmed = sourceTerms.has(stem(term));
      const method = exact
        ? "exact"
        : synonym
          ? "synonym"
          : stemmed
            ? "stem"
            : "missing";
      return {
        term,
        required,
        matched: method !== "missing",
        method,
        weight: Math.max(0.25, bm25) * (required ? 2 : 1),
      } satisfies Keyword;
    })
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 36);
}
export function analyzePdf(
  pdf: PdfText,
  source: string,
  jd: string,
  digest: string,
  artifact: string,
): AtsReport {
  const text = pdf.text;
  const wordCount = (text.match(/\S+/g) ?? []).length;
  const keywords = keywordsFor(text, jd);
  const contact = [
    ...new Set([
      ...(text.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi) ?? []),
      ...(text.match(/(?:\+?\d[\d ()-]{7,}\d)/g) ?? []),
      ...(text.match(/(?:linkedin\.com|github\.com)\/[\w/-]+/gi) ?? []),
    ]),
  ];
  const section = (name: string) => {
    const lines = text.split("\n");
    const start = lines.findIndex((line) =>
      new RegExp(`^\\s*${name}\\s*$`, "i").test(line),
    );
    if (start < 0) return "";
    const following = lines.slice(start + 1);
    const end = following.findIndex((line) =>
      /^\s*(experience|employment|work experience|education|skills|technical skills|projects|summary|certifications)\s*$/i.test(
        line,
      ),
    );
    return following.slice(0, end < 0 ? undefined : end).join("\n");
  };
  const sectionsAndContact = {
    contact,
    experience: section("(?:experience|employment|work experience)"),
    education: section("education"),
    skills: section("(?:skills|technical skills)"),
    dates: [
      ...new Set(
        text.match(
          /(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{4}|\b(?:19|20)\d{2}\b|Present/gi,
        ) ?? [],
      ),
    ],
  };
  const sections = {
    experience: sectionsAndContact.experience,
    education: sectionsAndContact.education,
    skills: sectionsAndContact.skills,
  };
  const parsed = parseFields(pdf, sections);
  const dateStyles = new Set(parsed.dates.map((range) => range.style));
  const dateConsistent =
    parsed.dates.length > 0 &&
    dateStyles.size === 1 &&
    !parsed.dates.some((range) => range.reversed);
  const quantifiedBullets = text
    .split("\n")
    .filter(
      (line) =>
        /\d/.test(line) &&
        /\b(built|reduced|increased|improved|saved|led|managed|delivered|developed|grew|launched)\b/i.test(
          line,
        ),
    ).length;
  const essentialSections = [
    sections.experience,
    sections.education,
    sections.skills,
  ].filter(Boolean).length;
  const findings: Finding[] = [
    {
      id: "contact",
      level: contact.length >= 2 ? "pass" : "warning",
      title: "Contact details",
      detail:
        contact.length >= 2
          ? "Email and a second contact method were extracted."
          : "Add a selectable email and phone or profile URL.",
    },
    {
      id: "sections",
      level: essentialSections === 3 ? "pass" : "warning",
      title: "Recognizable sections",
      detail: `${essentialSections}/3 core sections recognized from PDF reading order. Use Experience, Education, and Skills headings.`,
      fix: "sections",
    },
    {
      id: "selectable",
      level: pdf.lowTextPages.length ? "warning" : "pass",
      title: "Selectable text",
      detail: pdf.lowTextPages.length
        ? `Little selectable text on page(s) ${pdf.lowTextPages.join(", ")}. Image resumes may not parse.`
        : "Every page contains selectable text.",
    },
    {
      id: "columns",
      level: pdf.columns ? "warning" : "pass",
      title: "Reading order",
      detail: pdf.columns
        ? "Separated text bands suggest multiple columns. Inspect What ATS sees; a single column is safer for some parsers."
        : "No clear side-by-side text bands detected. This does not guarantee a parser's reading order.",
      fix: "columns",
    },
    {
      id: "dates",
      level: dateConsistent ? "pass" : "warning",
      title: "Dates",
      detail: dateConsistent
        ? "Recognizable ranges use a consistent date style and chronological order."
        : `Review date ranges: ${dateStyles.size > 1 ? "mixed month/year styles; " : ""}${parsed.dates.some((range) => range.reversed) ? "a start date follows its end date; " : ""}use one consistent month/year format.`,
    },
    {
      id: "length",
      level:
        wordCount >= 200 && wordCount <= 900 && pdf.pages <= 2
          ? "pass"
          : "warning",
      title: "Length",
      detail: `${wordCount} extracted words across ${pdf.pages} page(s). The 200–900 word and 1–2 page range is editorial guidance, not a hiring rule.`,
    },
    {
      id: "impact",
      level: quantifiedBullets > 0 ? "pass" : "warning",
      title: "Evidence of impact",
      detail: `${quantifiedBullets} line(s) pair an action verb with a number. Add verified outcomes when available; never invent metrics.`,
      fix: "impact",
    },
  ];
  const sourceAdvisories = [
    [
      /\\begin\{(?:tabular|tabularx|longtable)\}/,
      "Tables may change reading order.",
    ],
    [
      /\\(?:fa[A-Z]\w*|includegraphics)/,
      "Icons or images may carry information without selectable text.",
    ],
    [
      /\\(?:fancyhead|fancyfoot|lhead|rhead|cfoot)/,
      "Header/footer content may be ignored by parsers.",
    ],
    [
      /[ﬀﬁﬂﬃﬄ]/,
      "Unicode ligatures were found. Confirm their extracted spelling.",
    ],
  ] satisfies [RegExp, string][];
  for (const [index, [pattern, detail]] of sourceAdvisories.entries())
    if (
      pattern.test(source) ||
      (detail.includes("ligatures") && pattern.test(text))
    )
      findings.push({
        id: `advisory-${index}`,
        level: "warning",
        title: "Source advisory",
        detail: detail + " This is a source hint, not a measured PDF defect.",
      });
  const matchedWeight = keywords
    .filter((k) => k.matched)
    .reduce((sum, k) => sum + k.weight, 0);
  const totalWeight = keywords.reduce((sum, k) => sum + k.weight, 0);
  const breakdown = [
    {
      name: "PDF parseability",
      earned: Math.round(
        (pdf.lowTextPages.length ? 0 : 15) + (pdf.columns ? 5 : 15),
      ),
      possible: 30,
      detail: "Selectable text and geometric reading-order checks.",
    },
    {
      name: "Structure & contact",
      earned:
        Math.round((essentialSections / 3) * 15) +
        (contact.length >= 2 ? 5 : 0),
      possible: 20,
      detail: "Three recognizable core headings and contact details.",
    },
    {
      name: "Evidence & format",
      earned:
        (quantifiedBullets ? 8 : 0) +
        (dateConsistent ? 5 : 0) +
        (wordCount >= 200 && wordCount <= 900 ? 7 : 0),
      possible: 20,
      detail:
        "Verified-number opportunities, date recognition, and editorial length.",
    },
    ...(jd.trim()
      ? [
          {
            name: "Job language match",
            earned: Math.round(
              totalWeight ? (matchedWeight / totalWeight) * 30 : 0,
            ),
            possible: 30,
            detail:
              "BM25-weighted keyword coverage; required terms have 2× weight. Synonyms and suffix stems count.",
          },
        ]
      : []),
  ];
  return {
    digest,
    artifact,
    score: Math.round(
      (breakdown.reduce((sum, b) => sum + b.earned, 0) /
        breakdown.reduce((sum, b) => sum + b.possible, 0)) *
        100,
    ),
    breakdown,
    keywords,
    findings,
    parsed,
    sections,
    pdf,
    wordCount,
    quantifiedBullets,
    jobDescription: jd,
  };
}
