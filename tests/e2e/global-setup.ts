import { mkdir } from "node:fs/promises";
import { clerkSetup } from "@clerk/testing/playwright";
export default async function setup() {
  await mkdir("artifacts/refresh-after", { recursive: true });
  await mkdir(".data", { recursive: true });
  await clerkSetup({ dotenv: false });
}
