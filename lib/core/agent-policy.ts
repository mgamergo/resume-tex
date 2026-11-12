import { z } from "zod";
import { proposalInputSchema } from "./model";
import { resumeSchema, proposalSchema, revisionSummarySchema } from "./schemas";
export const agentEditModeSchema = z.enum(["review", "autonomous"]);
export const agentEditPolicySchema = z
  .object({
    mode: agentEditModeSchema,
    version: z.number().int().nonnegative(),
  })
  .strict();
export type AgentEditPolicy = z.infer<typeof agentEditPolicySchema>;
export const editContextSchema = z.object({
  resume: resumeSchema,
  policy: agentEditPolicySchema,
});
export type EditContext = z.infer<typeof editContextSchema>;
export const workspaceDetailsSchema = editContextSchema.extend({
  history: z.array(revisionSummarySchema),
  proposals: z.array(proposalSchema),
});
export type WorkspaceDetails = z.infer<typeof workspaceDetailsSchema>;
export const submitProposalSchema = z
  .object({
    resumeId: z.string().min(1).max(100),
    input: proposalInputSchema,
    expectedRevision: z.number().int().positive(),
    policyVersion: z.number().int().nonnegative(),
  })
  .strict();
export type SubmitProposal = z.infer<typeof submitProposalSchema>;
export const setAgentEditPolicySchema = z
  .object({
    resumeId: z.string().min(1).max(100),
    mode: agentEditModeSchema,
    expectedVersion: z.number().int().nonnegative(),
  })
  .strict();
export type SetAgentEditPolicy = z.infer<typeof setAgentEditPolicySchema>;
export const submissionResultSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("proposal"),
    proposal: proposalSchema.extend({ status: z.literal("pending") }),
  }),
  z.object({
    kind: z.literal("applied"),
    proposal: proposalSchema.extend({ status: z.literal("accepted") }),
    resume: resumeSchema,
  }),
]);
export type SubmissionResult = z.infer<typeof submissionResultSchema>;
