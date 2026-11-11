import type { Proposal } from "../core/model";
export function reconcileProposals(
  current: Proposal[],
  incoming: Proposal[],
): Proposal[] {
  const byId = new Map(current.map((proposal) => [proposal.id, proposal]));
  for (const proposal of incoming) {
    const previous = byId.get(proposal.id);
    if (
      previous &&
      previous.status !== "pending" &&
      proposal.status === "pending"
    )
      continue;
    byId.set(proposal.id, proposal);
  }
  return [...byId.values()];
}
