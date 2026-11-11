import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
export const metadata: Metadata = {
  title: "Resume TeX · A better draft, one line at a time",
  description:
    "LaTeX resume editor with a reviewable assistant and PDF-based ATS insights.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {process.env.APP_MODE === "connected" ? (
          <ClerkProvider>{children}</ClerkProvider>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
