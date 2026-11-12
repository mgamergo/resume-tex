export const convexFetchPolicy = { deadlineMs: 20_000 };
export class ConvexDeadlineError extends Error {
  constructor(cause: unknown) {
    super("Convex fetch deadline exceeded", { cause });
    this.name = "ConvexDeadlineError";
  }
}
export function createConvexFetch({
  deadlineMs = convexFetchPolicy.deadlineMs,
}: { deadlineMs?: number } = {}) {
  const boundedFetch = async (
    ...[input, init]: Parameters<typeof fetch>
  ): Promise<Response> => {
    const deadline = new AbortController();
    const timer = setTimeout(
      () =>
        deadline.abort(new DOMException("Deadline exceeded", "TimeoutError")),
      deadlineMs,
    );
    const callers: AbortSignal[] = [];
    if (input instanceof Request) callers.push(input.signal);
    if (init?.signal) callers.push(init.signal);
    const signal = AbortSignal.any([...callers, deadline.signal]);
    try {
      const response = await fetch(input, { ...init, signal });
      const body = response.body ? await response.arrayBuffer() : null;
      return new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } catch (error) {
      if (callers.some((caller) => caller.aborted))
        throw new DOMException("Storage request cancelled", "AbortError");
      if (deadline.signal.aborted) throw new ConvexDeadlineError(error);
      throw error;
    } finally {
      clearTimeout(timer);
    }
  };
  return Object.assign(boundedFetch, fetch);
}
