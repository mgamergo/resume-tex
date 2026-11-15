"use client";
import Link from "next/link";
import { SignIn, useUser } from "@clerk/nextjs";
import { Workspace } from "./workspace";
import { ThemeSelect } from "./theme-select";
import { Button } from "./ui/button";
export function AuthenticatedWorkspace() {
  const { isLoaded, isSignedIn, user } = useUser();
  if (isLoaded && isSignedIn) return <Workspace key={user.id} />;
  return (
    <main className="auth-screen">
      <header>
        <Link className="brand" href="/" aria-label="Resume TeX home">
          <span className="brand-mark">
            R<span>τ</span>
          </span>
          <strong>Resume TeX</strong>
        </Link>
        <div className="auth-header-actions">
          <ThemeSelect />
          <Button
            size="sm"
            onClick={() =>
              document
                .querySelector<HTMLInputElement>("#sign-in input")
                ?.focus()
            }
          >
            Sign in
          </Button>
        </div>
      </header>
      <section className="auth-content" id="sign-in" aria-label="Sign in">
        <div className="auth-intro">
          <h1>Your LaTeX workspace</h1>
          <p>Write, compile and keep every revision of your resume.</p>
        </div>
        {isLoaded ? (
          <SignIn
            routing="hash"
            fallbackRedirectUrl="/"
            appearance={{
              variables: {
                colorPrimary: "var(--primary)",
                colorPrimaryForeground: "var(--primary-foreground)",
                colorNeutral: "var(--foreground)",
                colorBorder: "var(--border)",
                colorBackground: "var(--card)",
                colorForeground: "var(--foreground)",
                colorMutedForeground: "var(--muted-foreground)",
                colorInput: "var(--background)",
                colorInputForeground: "var(--foreground)",
                borderRadius: "0.625rem",
                fontFamily: "Arial, Helvetica, sans-serif",
              },
              elements: {
                rootBox: "auth-widget",
                cardBox: "auth-card-box",
                card: "auth-card",
                footer: "auth-card-footer",
              },
            }}
          />
        ) : (
          <p role="status">Loading sign in…</p>
        )}
      </section>
    </main>
  );
}
