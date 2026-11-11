# PDF-derived resume checks

Analysis uses pdf.js text items from the **actual successfully compiled PDF**, including page number, baseline position, width and height. No LaTeX regex is presented as PDF parsing. A response is bound to source digest, engine, revision and artifact identity. An edited document or changed engine makes prior analysis stale. Source regexes are labeled separate advisories.

## Extraction and fields

What ATS sees preserves the PDF content-stream reading order and inserts line breaks from text baselines/EOL markers. It does not silently rearrange columns into a more flattering reading order. Named contact fields, experience entries, education entries, skill arrays and date ranges are deterministic best-effort parses with raw evidence and confidence. Recognized English headings bound sections. Education splits recognized institutions into separate entries. Experience uses date ranges and adjacent title/employer lines, so unusual formats can remain ambiguous. Phone candidates are constrained to the header and plausible digit lengths; employment years alone do not count as contact details.

Selectable text under 80 non-space characters per page raises a warning. Geometry flags possible columns when at least five quantized horizontal bands contain separated left/right items. This can warn on date columns too; inspect the raw extraction. Tables, icon commands, images, headers and footers in source create advisories, not proven PDF defects. Unicode ligatures are checked in source and extracted text. There is no OCR or image semantics, no proof of reading order for every vendor, and no uploaded-PDF parser in v1. At most ten PDF pages are analyzed.

Dates accept named month/year, numeric month/year and year-only ranges with hyphen/en-dash/to separators. Mixed styles and a start after an end are flagged. Different date granularity can be legitimate; the warning requests review. Contact/profile text, page/word length and action-verb-plus-number lines are explainable clues. The default editorial length range is 200–900 extracted words and at most two pages; it is not an employer rule.

## Job-language matching

The job description is the local corpus. Documents are its non-empty lines/sentences, preserving dots inside Node.js and Next.js. Requirements/qualifications headings apply required context to following bullets until a preferred/nice-to-have/optional heading changes it. Required terms receive twice the weight. Context inference is heuristic, not a legal or employer interpretation.

Candidates include a documented source-code skill dictionary and up to 18 frequent non-stopword terms, capped at 36 report terms. Exact matches, explicit aliases (for example PostgreSQL/Postgres, Kubernetes/k8s), and simple suffix stems are reported separately. Suffix stripping is intentionally lightweight, not full linguistic normalization. Ambiguous `JS` is not inferred from the `.js` part of Node.js.

For each term, inverse document frequency is `ln(1 + (N - df + 0.5)/(df + 0.5))`. BM25 sums `idf × tf × (k1+1) / (tf + k1 × (1-b+b×dl/avgdl))` across JD lines, with `k1=1.2` and `b=0.75`. Term weight is `max(0.25, BM25) × (required ? 2 : 1)`. Match coverage is the matched term weights divided by all term weights. A single short JD is a small corpus; weighting is relative to that pasted text and can be unstable. It is not a learned employer relevance model. Missing terms are prompts to check evidence, never permission to add skills that you lack.

## Readiness number

| Component             | Available points          | Evidence                                                                                       |
| --------------------- | ------------------------- | ---------------------------------------------------------------------------------------------- |
| PDF parseability      | 30                        | 15 for selectable text on every page; 15 for no detected columns, 5 when columns are detected. |
| Structure and contact | 20                        | 5 each for recognized Experience, Education, Skills; 5 for at least two contact methods.       |
| Evidence and format   | 20                        | 8 for an action/number line; 5 for consistent recognized ranges; 7 for editorial word range.   |
| Job-language match    | 30, when a JD is supplied | Rounded BM25-weighted coverage.                                                                |

The displayed score is earned/available ×100, so no-JD analysis uses 70 available points. Separate findings may warn about page count, source constructs or ambiguity without changing the number. A high score does not prove truth, aesthetic quality, accessibility, or compatibility with every ATS. This score is **not** a hiring probability or a prediction of a proprietary vendor score.

## Fixes

A section finding creates a bounded section-insertion proposal with a visible placeholder. Supported two-minipage column layouts can produce exact wrapper-removal edits while preserving all facts. Impact findings ask the author for **verified evidence**; the author's explicit input becomes a targeted bullet proposal. Unknown structural layouts require manual review. Every assistant change is reviewable before acceptance. New numbers/known skill names require support in source or explicitly supplied author evidence.

## Sources

Vendor claims and their limits are collected in [primary-source research](ats-vendor-research.md). The references cover [Greenhouse parse failure guidance](https://support.greenhouse.io/hc/en-us/articles/200989175-Unsuccessful-resume-parse), [Lever resume parsing](https://help.lever.co/s/article/Understanding-Resume-Parsing), [Oracle Taleo plain-text parsing](https://docs.oracle.com/en/cloud/saas/taleo-enterprise/23a/otcug/c-plaintextresumeparsingmobile.html), [Jobscan's tutorial](https://www.jobscan.co/jobscan-tutorial), [Resume Worded's score explanation](https://help.resumeworded.com/article/33-how-is-my-score-calculated), [Workday's candidate-profile documentation](https://community-content.workday.com/en-us/public/products/talent-management/talent-acquisition/workday-candidate-profile.html), and the [Stanford IR BM25 reference](https://nlp.stanford.edu/IR-book/html/htmledition/okapi-bm25-a-non-binary-model-1.html). No public source establishes Workday's proprietary screening internals; this app does not invent them.
