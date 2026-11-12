import type { Resume } from "../core/model";
export function classifyResumeHead(input: {
  baseline: Resume;
  draft: Pick<Resume, "source" | "engine">;
  incoming: Resume;
  busy: boolean;
}): "ignore" | "defer" | "adopt" | "metadata" | "conflict" {
  const { baseline, draft, incoming, busy } = input;
  if (incoming.id !== baseline.id || incoming.revision <= baseline.revision)
    return "ignore";
  if (busy) return "defer";
  if (
    (draft.source === baseline.source && draft.engine === baseline.engine) ||
    (draft.source === incoming.source && draft.engine === incoming.engine)
  )
    return "adopt";
  if (
    incoming.source === baseline.source &&
    incoming.engine === baseline.engine
  )
    return "metadata";
  return "conflict";
}
