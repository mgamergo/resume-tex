import { test, expect } from "bun:test";
import { classifyResumeHead } from "../../lib/client/resume-head";
import type { Resume } from "../../lib/core/model";
const baseline: Resume = {
  id: "one",
  name: "Resume",
  source: "saved",
  digest: "base",
  engine: "pdflatex",
  revision: 1,
  updatedAt: 0,
  template: "jake",
};
const incoming: Resume = {
  ...baseline,
  source: "remote",
  digest: "remote",
  revision: 2,
};
test("clean remote changes are adopted and stale or foreign heads are ignored", () => {
  expect(
    classifyResumeHead({ baseline, incoming, draft: baseline, busy: false }),
  ).toBe("adopt");
  expect(
    classifyResumeHead({
      baseline: incoming,
      incoming: baseline,
      draft: incoming,
      busy: false,
    }),
  ).toBe("ignore");
  expect(
    classifyResumeHead({
      baseline,
      incoming: { ...incoming, id: "two" },
      draft: baseline,
      busy: false,
    }),
  ).toBe("ignore");
});
test("remote source cannot replace typing or advance a dirty CAS baseline", () => {
  expect(
    classifyResumeHead({
      baseline,
      incoming,
      draft: { source: "typed locally", engine: "pdflatex" },
      busy: false,
    }),
  ).toBe("conflict");
  expect(
    classifyResumeHead({
      baseline,
      incoming,
      draft: { source: "saved", engine: "xelatex" },
      busy: false,
    }),
  ).toBe("conflict");
});
test("saving and applying defer remote changes even while the draft appears clean", () => {
  expect(
    classifyResumeHead({ baseline, incoming, draft: baseline, busy: true }),
  ).toBe("defer");
  expect(
    classifyResumeHead({ baseline, incoming, draft: incoming, busy: true }),
  ).toBe("defer");
});
test("matching drafts can be acknowledged and metadata-only revisions preserve typing", () => {
  expect(
    classifyResumeHead({ baseline, incoming, draft: incoming, busy: false }),
  ).toBe("adopt");
  expect(
    classifyResumeHead({
      baseline,
      incoming: { ...baseline, revision: 2, name: "Renamed" },
      draft: { source: "typed", engine: "pdflatex" },
      busy: false,
    }),
  ).toBe("metadata");
});
