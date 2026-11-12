import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
export const metadata: Metadata = {
  title: "Resume TeX",
  description:
    "LaTeX resume editor with a reviewable assistant and PDF-based ATS insights.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="system" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t="system";try{var v=localStorage.getItem("resume-tex-theme");if(v==="light"||v==="dark")t=v;}catch{}document.documentElement.dataset.theme=t;})();`,
          }}
        />
      </head>
      <body>
        <ClerkProvider>{children}</ClerkProvider>
      </body>
    </html>
  );
}
