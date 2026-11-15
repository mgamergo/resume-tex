"use client";
import { useState } from "react";
import { KeyRound } from "lucide-react";
import { z } from "zod";
import { api } from "@/lib/client/api";
import { agentKeySchema, type AgentKey } from "@/lib/core/mcp";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
export function McpKeys() {
  const [open, setOpen] = useState(false);
  const [keys, setKeys] = useState<AgentKey[]>([]);
  const [label, setLabel] = useState("");
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  async function load() {
    setLoading(true);
    setError("");
    try {
      setKeys(
        (
          await api(
            "/api/mcp/keys",
            z.object({ keys: z.array(agentKeySchema) }),
          )
        ).keys,
      );
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not load MCP keys",
      );
    } finally {
      setLoading(false);
    }
  }
  async function issue() {
    if (busy) return;
    setBusy(true);
    setError("");
    setSecret("");
    try {
      const result = await api(
        "/api/mcp/keys",
        z.object({ key: agentKeySchema, secret: z.string() }),
        { op: "issue", label },
      );
      setSecret(result.secret);
      setKeys((current) => [...current, result.key]);
      setLabel("");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not create key",
      );
    } finally {
      setBusy(false);
    }
  }
  async function revoke(id: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api("/api/mcp/keys", z.object({ ok: z.boolean() }), {
        op: "revoke",
        id,
      });
      setKeys((current) => current.filter((key) => key.id !== id));
      setSecret("");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not revoke key",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (busy) return;
        setOpen(value);
        setSecret("");
        if (value) void load();
      }}
    >
      <DialogTrigger asChild>
        <Button
          className="mcp-trigger"
          variant="ghost"
          size="sm"
          aria-label="Manage MCP keys"
        >
          <KeyRound size={15} />
          <span>MCP</span>
        </Button>
      </DialogTrigger>
      <DialogContent
        className="mcp-dialog"
        onInteractOutside={(event) => {
          if (busy) event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Connect your agents</DialogTitle>
          <DialogDescription>
            Keys let your agents read and edit your resumes and obtain PDFs.
            Keep them private. Keys expire after 90 days.
          </DialogDescription>
        </DialogHeader>
        <label htmlFor="mcp-endpoint">MCP endpoint</label>
        <Input
          id="mcp-endpoint"
          readOnly
          value={
            typeof window === "undefined"
              ? ""
              : `${window.location.origin}/api/mcp`
          }
        />
        {loading ? (
          <p role="status">Loading keys…</p>
        ) : (
          <>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void issue();
              }}
            >
              <label htmlFor="key-label">Agent name</label>
              <div className="key-create">
                <Input
                  id="key-label"
                  maxLength={60}
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  placeholder="My coding agent"
                  disabled={busy}
                />
                <Button disabled={busy || !label.trim()} type="submit">
                  Create key
                </Button>
              </div>
            </form>
            {secret && (
              <div className="key-secret">
                <label htmlFor="mcp-secret">
                  Copy this key now. It is shown once.
                </label>
                <Input
                  id="mcp-secret"
                  readOnly
                  value={secret}
                  onFocus={(event) => event.target.select()}
                />
                <p>
                  Use it as the Authorization bearer token in your MCP client.
                </p>
              </div>
            )}
            <ul className="key-list">
              {keys.map((key) => (
                <li key={key.id}>
                  <div>
                    <strong>{key.label}</strong>
                    <small>
                      {key.prefix}… · Expires{" "}
                      {new Date(key.expiresAt).toLocaleDateString()}
                    </small>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => void revoke(key.id)}
                    aria-label={`Revoke ${key.label}`}
                  >
                    Revoke
                  </Button>
                </li>
              ))}
            </ul>
            {!keys.length && !error && (
              <p>No connected agents. Create a key to connect one.</p>
            )}
          </>
        )}
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
