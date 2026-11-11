import { reportUpstreamError } from "./upstream-diagnostics";
import { ConvexError } from "convex/values";
import { z } from "zod";
import { DomainError } from "../core/model";
const errorData = z
  .object({
    kind: z.literal("resume-tex"),
    status: z.number().int().min(400).max(499),
    code: z.enum([
      "unauthenticated",
      "not_found",
      "conflict",
      "invalid",
      "limit",
    ]),
    message: z.string().min(1).max(300),
  })
  .strict();
export function mapConvexError(error: unknown): DomainError | undefined {
  if (!(error instanceof ConvexError)) return;
  const parsed = errorData.safeParse(error.data);
  if (parsed.success)
    return new DomainError(parsed.data.message, parsed.data.status);
}
export async function convexOperation<T>(
  operation: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();
  try {
    return await operation();
  } catch (error) {
    const mapped = mapConvexError(error);
    if (mapped) throw mapped;
    reportUpstreamError("convex", error, startedAt);
    throw error;
  }
}
