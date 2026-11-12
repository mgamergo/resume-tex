"use client";
import { SignInButton, useUser } from "@clerk/nextjs";
import { Workspace } from "./workspace";
import { ThemeSelect } from "./theme-select";
import { Button } from "./ui/button";
export function AuthenticatedWorkspace() {
  const { isLoaded, isSignedIn, user } = useUser();
  if (isLoaded && isSignedIn) return <Workspace key={user.id} />;
  return (
    <main className="auth-screen">
      <header>
        <strong>Resume TeX</strong>
        <ThemeSelect />
      </header>
      <section>
        <h1>Sign in to Resume TeX</h1>
        {isLoaded ? (
          <SignInButton mode="modal">
            <Button>Sign in</Button>
          </SignInButton>
        ) : (
          <p role="status">Loading…</p>
        )}
      </section>
    </main>
  );
}
