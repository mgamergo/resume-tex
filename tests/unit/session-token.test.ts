import { expect, test } from "bun:test";
import {
  acquireSessionToken,
  isTokenTransportFailure,
} from "../../lib/server/session-token";
const transport = () =>
  Object.assign(new Error(), {
    errors: [{ code: "unexpected_error", message: "fetch failed" }],
  });
test("token acquisition retries exactly once for known transport failure before any store operation", async () => {
  let attempts = 0;
  expect(
    await acquireSessionToken(async () => {
      if (++attempts === 1) throw transport();
      return "fixture-token";
    }, new AbortController().signal),
  ).toBe("fixture-token");
  expect(attempts).toBe(2);
  attempts = 0;
  await expect(
    acquireSessionToken(async () => {
      attempts++;
      throw transport();
    }, new AbortController().signal),
  ).rejects.toMatchObject({ status: 503 });
  expect(attempts).toBe(2);
});
test("auth, configuration, unknown failures and caller cancellation are never retried", async () => {
  for (const error of [
    Object.assign(transport(), { status: 401 }),
    Object.assign(transport(), { status: 429 }),
    new Error("unknown"),
    { errors: [{ code: "session_not_found", message: "fetch failed" }] },
    { errors: [{ code: "unexpected_error", message: "unknown" }] },
  ]) {
    let attempts = 0;
    await expect(
      acquireSessionToken(async () => {
        attempts++;
        throw error;
      }, new AbortController().signal),
    ).rejects.toBe(error);
    expect(attempts).toBe(1);
  }
  const abort = new AbortController();
  let attempts = 0;
  const pending = acquireSessionToken(async () => {
    attempts++;
    queueMicrotask(() => abort.abort());
    throw transport();
  }, abort.signal);
  await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  expect(attempts).toBe(1);
  await expect(
    acquireSessionToken(async () => {
      attempts++;
      return null;
    }, abort.signal),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(attempts).toBe(1);
  const delayedAbort = new AbortController();
  let delayedAttempts = 0;
  const delayed = acquireSessionToken(async () => {
    delayedAttempts++;
    throw transport();
  }, delayedAbort.signal);
  const abortTimer = setTimeout(() => delayedAbort.abort(), 10);
  try {
    await expect(delayed).rejects.toMatchObject({ name: "AbortError" });
    expect(delayedAttempts).toBe(1);
  } finally {
    clearTimeout(abortTimer);
  }
  expect(
    isTokenTransportFailure(
      Object.assign(new Error("fetch failed"), { cause: { status: 403 } }),
    ),
  ).toBe(false);
});
