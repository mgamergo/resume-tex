import { test, expect } from "bun:test";
import { reconcileProposals } from "../../lib/client/proposals";
import type { Proposal } from "../../lib/core/model";
const pending: Proposal = {
  id: "id",
  resumeId: "resume",
  baseDigest: "d",
  title: "Proposal",
  explanation: "",
  edits: [{ start: 0, end: 0, expected: "", replacement: "x" }],
  evidenceNeeded: [],
  createdAt: 0,
  status: "pending",
};
test("polling and proposal responses deduplicate IDs and cannot resurrect reviewed proposals", () => {
  expect(reconcileProposals([pending], [pending])).toHaveLength(1);
  for (const status of [
    "accepted",
    "rejected",
  ] satisfies Proposal["status"][]) {
    const reviewed = { ...pending, status };
    expect(reconcileProposals([reviewed], [pending])).toEqual([reviewed]);
    expect(reconcileProposals([pending], [reviewed])).toEqual([reviewed]);
  }
});
