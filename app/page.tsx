import { Workspace } from "@/components/workspace";
export const dynamic = "force-dynamic";
export default function Page() {
  return (
    <Workspace
      mode={process.env.APP_MODE === "local" ? "local" : "connected"}
      assistantMode={
        process.env.AI_PROVIDER === "mock" ? "offline" : "configured"
      }
    />
  );
}
