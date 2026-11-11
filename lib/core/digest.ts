import { createHash } from "node:crypto";
export function digest(source: string) {
  return createHash("sha256").update(source).digest("hex");
}
