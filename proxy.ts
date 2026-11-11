import { clerkMiddleware } from "@clerk/nextjs/server";
import {
  NextResponse,
  type NextRequest,
  type NextFetchEvent,
} from "next/server";
const handler = clerkMiddleware();
export default function proxy(request: NextRequest, event: NextFetchEvent) {
  if (process.env.APP_MODE === "connected") return handler(request, event);
  return NextResponse.next();
}
export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|mjs)).*)",
    "/(api|trpc)(.*)",
  ],
};
