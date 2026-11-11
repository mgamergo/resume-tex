import { test, expect } from "bun:test";
import { isNavigationCancellation, sanitize } from "../e2e/diagnostics";
const workspace = {
  recordedBeforeNavigation: true,
  method: "GET",
  url: "http://localhost:3100/api/workspace?id=fixture",
  failure: "net::ERR_ABORTED",
  appOrigin: "http://localhost:3100",
  clerkHost: "fixture.clerk.accounts.dev",
};
const token = {
  ...workspace,
  method: "POST",
  url: "https://fixture.clerk.accounts.dev/v1/client/sessions/sess_fixture/tokens?testing_token=private",
};
test("navigation cancellation attribution accepts only recorded old workspace reads and the exact Clerk token endpoint", () => {
  expect(isNavigationCancellation(workspace)).toBe(true);
  expect(isNavigationCancellation(token)).toBe(true);
  for (const input of [
    { ...workspace, recordedBeforeNavigation: false },
    { ...token, recordedBeforeNavigation: false },
    { ...workspace, method: "POST" },
    { ...token, method: "GET" },
    { ...workspace, failure: "net::ERR_CONNECTION_RESET" },
    { ...token, failure: "HTTP 500" },
    { ...workspace, url: "http://other.example/api/workspace" },
    {
      ...token,
      url: "https://other.clerk.accounts.dev/v1/client/sessions/sess_fixture/tokens",
    },
    {
      ...token,
      url: "http://fixture.clerk.accounts.dev/v1/client/sessions/sess_fixture/tokens",
    },
    {
      ...token,
      url: "https://fixture.clerk.accounts.dev:444/v1/client/sessions/sess_fixture/tokens",
    },
    {
      ...token,
      url: "https://fixture.clerk.accounts.dev/v1/client/sessions/sess_fixture/tokens/convex",
    },
    {
      ...token,
      url: "https://fixture.clerk.accounts.dev/v1/client/sessions/sess_fixture",
    },
    { ...token, url: "not-a-url" },
  ])
    expect(isNavigationCancellation(input)).toBe(false);
});
test("diagnostics redact query strings opaque Clerk identifiers and credentials", () => {
  const result = sanitize(
    "failed https://fixture.clerk.accounts.dev/v1/client/sessions/sess_fixture/tokens?ticket=private sk_test_private eyJprivate.payload.signature",
  );
  expect(result).not.toContain("sess_fixture");
  expect(result).not.toContain("ticket=");
  expect(result).not.toContain("sk_test_private");
  expect(result).not.toContain("eyJprivate");
});

test("only old Clerk avatar image cancellation during explicit navigation is attributable", () => {
  const image = {
    ...workspace,
    resourceType: "image",
    url: "https://img.clerk.com/eyJfixture",
  };
  expect(isNavigationCancellation(image)).toBe(true);
  for (const input of [
    { ...image, recordedBeforeNavigation: false },
    { ...image, resourceType: "fetch" },
    { ...image, method: "POST" },
    { ...image, url: "http://img.clerk.com/eyJfixture" },
    { ...image, url: "https://img.clerk.com:444/eyJfixture" },
    { ...image, url: "https://img.clerk.com.example/eyJfixture" },
    { ...image, url: "https://img.clerk.com/other" },
    { ...image, failure: "net::ERR_CONNECTION_RESET" },
    { ...image, failure: "HTTP 500" },
  ])
    expect(isNavigationCancellation(input)).toBe(false);
});
