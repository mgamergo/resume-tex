export function sanitize(value: string) {
  return value
    .replace(/https?:\/\/[^\s)]+/g, (url) => {
      try {
        const parsed = new URL(url);
        return parsed.origin + parsed.pathname;
      } catch {
        return "[url]";
      }
    })
    .replace(/eyJ[a-zA-Z0-9_.-]+/g, "[redacted]")
    .replace(/\b(?:user|sess|client|ins|sit)_[A-Za-z0-9]+/g, "[id]")
    .replace(/\b(?:sk|pk)_(?:test|live)_[A-Za-z0-9]+/g, "[redacted]");
}
export function isNavigationCancellation(input: {
  recordedBeforeNavigation: boolean;
  method: string;
  url: string;
  failure: string | undefined;
  appOrigin: string;
  clerkHost: string;
}) {
  if (!input.recordedBeforeNavigation || input.failure !== "net::ERR_ABORTED")
    return false;
  let url: URL;
  try {
    url = new URL(input.url);
  } catch {
    return false;
  }
  const workspaceRead =
    input.method === "GET" &&
    url.origin === input.appOrigin &&
    url.pathname === "/api/workspace";
  const clerkToken =
    input.method === "POST" &&
    url.protocol === "https:" &&
    url.hostname === input.clerkHost &&
    url.port === "" &&
    /^\/v1\/client\/sessions\/[^/]+\/tokens$/.test(url.pathname);
  return workspaceRead || clerkToken;
}
