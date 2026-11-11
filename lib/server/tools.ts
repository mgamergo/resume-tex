import { knownSkills } from "../core/ats";
import { z } from "zod";
import {
  DomainError,
  editSchema,
  proposalInputSchema,
  type Resume,
  type ProposalInput,
} from "../core/model";
import type { Store } from "./store";
export const toolNames = [
  "read_document",
  "range_patch",
  "insert_section",
  "rewrite_bullet",
  "reorder_sections",
  "fix_compile_error",
  "tailor_to_job",
  "flatten_columns",
] as const;
export const toolCallSchema = z.discriminatedUnion("tool", [
  z.object({ tool: z.literal("read_document") }),
  z.object({ tool: z.literal("flatten_columns") }),
  z.object({
    tool: z.literal("range_patch"),
    title: z.string().max(120),
    edits: z.array(editSchema).min(1).max(30),
  }),
  z.object({
    tool: z.literal("insert_section"),
    heading: z.string().min(1).max(60),
    content: z.string().min(1).max(8000),
  }),
  z.object({
    tool: z.literal("rewrite_bullet"),
    start: z.number().int().nonnegative(),
    end: z.number().int().nonnegative(),
    replacement: z.string().max(8000),
  }),
  z.object({
    tool: z.literal("reorder_sections"),
    order: z.array(z.string().max(60)).min(2).max(20),
  }),
  z.object({
    tool: z.literal("fix_compile_error"),
    log: z.string().max(100_000),
  }),
  z.object({
    tool: z.literal("tailor_to_job"),
    jobDescription: z.string().min(10).max(20_000),
  }),
]);
export type ToolCall = z.infer<typeof toolCallSchema>;
export const toolDescriptions: Record<ToolCall["tool"], string> = {
  flatten_columns:
    "Remove supported minipage column wrappers while preserving their contents.",
  read_document: "Read authoritative source, digest, revision and line ranges.",
  range_patch: "Propose bounded exact source edits. Never applies them.",
  insert_section: "Propose a section immediately before end document.",
  rewrite_bullet:
    "Propose one bullet rewrite preserving all established facts.",
  reorder_sections:
    "Reorder complete existing sections without losing content.",
  fix_compile_error:
    "Propose a precise repair for a supported compilation diagnostic.",
  tailor_to_job:
    "Reorder existing bullet evidence by job-description relevance. No new claims.",
};
function ensureFacts(
  resume: Resume,
  proposal: ProposalInput,
  verifiedEvidence = "",
) {
  const evidenceSource = resume.source + "\n" + verifiedEvidence;
  const sourceNumbers = new Set(evidenceSource.match(/\d+(?:\.\d+)?/g) ?? []);
  for (const edit of proposal.edits) {
    for (const skill of knownSkills)
      if (
        edit.replacement.toLowerCase().includes(skill) &&
        !evidenceSource.toLowerCase().includes(skill)
      )
        throw new DomainError(
          `This edit introduces an unsupported skill (${skill}). Add your verified evidence to the source first.`,
          422,
        );
    for (const number of edit.replacement.match(/\d+(?:\.\d+)?/g) ?? [])
      if (!sourceNumbers.has(number))
        throw new DomainError(
          "This edit introduces an unsupported number. Add verified evidence to your source first.",
          422,
        );
  }
  return proposal;
}
function latexEscape(value: string) {
  return value.replace(
    /[\\{}$&#%_~^]/g,
    (character) =>
      ({
        "\\": "\\textbackslash{}",
        "{": "\\{",
        "}": "\\}",
        $: "\\$",
        "&": "\\&",
        "#": "\\#",
        "%": "\\%",
        _: "\\_",
        "~": "\\textasciitilde{}",
        "^": "\\textasciicircum{}",
      })[character] ?? character,
  );
}
export function buildProposal(
  resume: Resume,
  call: Exclude<ToolCall, { tool: "read_document" }>,
  verifiedEvidence = "",
): ProposalInput {
  const base = { baseDigest: resume.digest, evidenceNeeded: [] as string[] };
  if (call.tool === "range_patch") {
    const span = call.edits.reduce(
      (sum, edit) =>
        sum + Math.max(edit.end - edit.start, edit.replacement.length),
      0,
    );
    if (
      span > 8000 ||
      call.edits.some((edit) => edit.end - edit.start > 4000) ||
      call.edits.some(
        (edit) => edit.start === 0 && edit.end >= resume.source.length,
      ) ||
      span > resume.source.length * 0.5
    )
      throw new DomainError(
        "Range patches must be targeted edits, not a document rewrite",
        422,
      );
  }
  if (call.tool === "rewrite_bullet") {
    const selected = resume.source.slice(call.start, call.end);
    if (
      call.end <= call.start ||
      selected.length > 2000 ||
      selected.includes("\n") ||
      call.replacement.includes("\n") ||
      /\\(?:documentclass|section|begin|end)\b/.test(
        selected + call.replacement,
      )
    )
      throw new DomainError(
        "Select a single bullet line of at most 2000 characters",
        422,
      );
  }
  let proposal: ProposalInput;
  switch (call.tool) {
    case "flatten_columns": {
      const starts = [
        ...resume.source.matchAll(
          /\\begin\{minipage\}(?:\[[^\]]{0,12}\])?\{0\.\d+\\textwidth\}/g,
        ),
      ];
      const ends = [
        ...resume.source.matchAll(/\\end\{minipage\}(?:\\hfill)?/g),
      ];
      if (starts.length !== 2 || ends.length !== 2)
        throw new DomainError(
          "Automatic column flattening supports the Deedy and AltaCV-style two-minipage layouts only.",
          422,
        );
      proposal = {
        ...base,
        title: "Make the layout one column",
        explanation:
          "Removes only the two minipage wrappers and their spacer. All section text and achievements remain intact. Compile and inspect the new reading order before keeping it.",
        edits: [...starts, ...ends].map((match) => ({
          start: match.index,
          end: match.index + match[0].length,
          expected: match[0],
          replacement: "\n\\par\n",
        })),
      };
      break;
    }

    case "range_patch":
      proposal = {
        ...base,
        title: call.title,
        explanation:
          "Exact range edits proposed by a structured tool. Review every changed line before accepting.",
        edits: call.edits,
      };
      break;
    case "insert_section": {
      const start = resume.source.lastIndexOf("\\end{document}");
      if (start < 0)
        throw new DomainError(
          "Add a document environment before inserting a section",
        );
      proposal = {
        ...base,
        title: `Insert ${call.heading}`,
        explanation:
          "New section uses only the content you supplied. Confirm the facts in review.",
        edits: [
          {
            start,
            end: start,
            expected: "",
            replacement: `\\section{${latexEscape(call.heading)}}\n${latexEscape(call.content)}\n`,
          },
        ],
      };
      break;
    }
    case "rewrite_bullet":
      proposal = {
        ...base,
        title: "Rewrite bullet",
        explanation:
          "Preserve the original achievement, scope and metrics. Confirm that every claim remains accurate.",
        edits: [
          {
            start: call.start,
            end: call.end,
            expected: resume.source.slice(call.start, call.end),
            replacement: call.replacement,
          },
        ],
      };
      break;
    case "reorder_sections": {
      const matches = [...resume.source.matchAll(/\\section\*?\{([^}]+)\}/g)];
      const names = matches.map((m) => m[1]);
      if (
        call.order.length !== names.length ||
        new Set(call.order).size !== names.length ||
        call.order.some((name) => !names.includes(name))
      )
        throw new DomainError(
          `Supply each section exactly once: ${names.join(", ")}`,
        );
      const start = matches[0]?.index;
      const end = resume.source.lastIndexOf("\\end{document}");
      if (start === undefined || end < start)
        throw new DomainError("No reorderable document sections found");
      if (/\\begin\{minipage\}/.test(resume.source))
        throw new DomainError(
          "Reordering a column layout needs manual layout review. Switch to a single column first.",
          422,
        );
      const pieces = new Map(
        matches.map((match, index) => [
          match[1],
          resume.source.slice(match.index, matches[index + 1]?.index ?? end),
        ]),
      );
      proposal = {
        ...base,
        title: "Reorder sections",
        explanation:
          "Moves existing sections intact; source content and facts are preserved.",
        edits: [
          {
            start,
            end,
            expected: resume.source.slice(start, end),
            replacement: call.order.map((name) => pieces.get(name)).join(""),
          },
        ],
      };
      break;
    }
    case "fix_compile_error": {
      const source = resume.source;
      if (
        /Emergency stop|no legal \\end|end occurred/i.test(call.log) &&
        !source.includes("\\end{document}")
      ) {
        proposal = {
          ...base,
          title: "Close the document",
          explanation:
            "The compile log reports an unfinished document. Add the missing closing command.",
          edits: [
            {
              start: source.length,
              end: source.length,
              expected: "",
              replacement: "\n\\end{document}\n",
            },
          ],
        };
      } else {
        const match = call.log.match(
          /Undefined control sequence[\s\S]{0,200}?(\\[A-Za-z]+)/,
        );
        const typo = match?.[1];
        const corrections: Record<string, string> = {
          "\\secton": "\\section",
          "\\textb": "\\textbf",
          "\\resumItem": "\\resumeItem",
          "\\itme": "\\item",
        };
        const replacement = typo ? corrections[typo] : undefined;
        const start = typo ? source.indexOf(typo) : -1;
        if (!typo || !replacement || start < 0)
          throw new DomainError(
            "No safe automatic fix is known for this diagnostic. Click its line number to review the source, or use a configured AI provider.",
            422,
          );
        proposal = {
          ...base,
          title: "Repair LaTeX command",
          explanation: `Replace the misspelled ${typo} command identified in the log.`,
          edits: [
            { start, end: start + typo.length, expected: typo, replacement },
          ],
        };
      }
      break;
    }
    case "tailor_to_job": {
      const matches = [
        ...resume.source.matchAll(
          /^[ \t]*\\(?:resumeItem\{[^\n]+\}|item(?:\[[^\]\n]*\])?\s+[^\n]+)/gm,
        ),
      ];
      const terms = (
        call.jobDescription.toLowerCase().match(/[a-z][a-z.+#-]{2,}/g) ?? []
      ).filter(
        (word) =>
          ![
            "the",
            "and",
            "with",
            "for",
            "are",
            "you",
            "our",
            "your",
            "have",
            "must",
            "experience",
          ].includes(word),
      );
      const bullets = matches.map((match) => ({
        match,
        score: terms.filter((term) => match[0].toLowerCase().includes(term))
          .length,
      }));
      const adjacent: typeof bullets = [];
      for (const bullet of bullets) {
        if (
          adjacent.length &&
          resume.source
            .slice(
              (adjacent.at(-1)?.match.index ?? 0) +
                (adjacent.at(-1)?.match[0].length ?? 0),
              bullet.match.index,
            )
            .trim()
        )
          break;
        adjacent.push(bullet);
      }
      const sorted = [...adjacent].sort((a, b) => b.score - a.score);
      if (
        adjacent.length < 2 ||
        sorted.every((value, index) => value === adjacent[index])
      )
        throw new DomainError(
          "Existing bullets are already in relevance order, or there is insufficient evidence. Add truthful experience before tailoring.",
          422,
        );
      const start = adjacent[0].match.index;
      const last = adjacent.at(-1);
      if (!last) throw new DomainError("No bullet evidence found");
      const end = last.match.index + last.match[0].length;
      proposal = {
        ...base,
        title: "Prioritize relevant evidence",
        explanation:
          "Reorders existing adjacent bullets by job-language overlap. No achievements or skills are added.",
        edits: [
          {
            start,
            end,
            expected: resume.source.slice(start, end),
            replacement: sorted.map((value) => value.match[0]).join("\n"),
          },
        ],
      };
      break;
    }
  }
  return ensureFacts(
    resume,
    proposalInputSchema.parse(proposal),
    verifiedEvidence,
  );
}
export async function executeTool(
  store: Store,
  resumeId: string,
  call: ToolCall,
  baseDigest?: string,
  verifiedEvidence = "",
) {
  const resume = await store.get(resumeId);
  if (
    call.tool !== "read_document" &&
    (!baseDigest || resume.digest !== baseDigest)
  )
    throw new DomainError(
      "Document changed while the edit was being prepared. Request a fresh proposal.",
      409,
    );
  if (call.tool === "read_document")
    return {
      kind: "document" as const,
      resume,
      lines: resume.source
        .split("\n")
        .map((text, index) => ({ line: index + 1, text })),
    };
  return {
    kind: "proposal" as const,
    proposal: await store.propose(
      resumeId,
      buildProposal(resume, call, verifiedEvidence),
    ),
  };
}
