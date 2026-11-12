import {
  resumeSchema,
  resumeSummarySchema,
  revisionSchema,
  proposalSchema,
  revisionSummarySchema,
} from "../../lib/core/schemas";
import { z } from "zod";
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import {
  applyEdits,
  DomainError,
  type Engine,
  type Proposal,
  type Resume,
  type Revision,
  type RevisionSummary,
  type ResumeSummary,
} from "../../lib/core/model";
import { digest } from "../../lib/core/digest";
import {
  agentEditPolicySchema,
  type AgentEditPolicy,
  type SetAgentEditPolicy,
  type SubmitProposal,
  type SubmissionResult,
} from "../../lib/core/agent-policy";
const policies = new Map<string, AgentEditPolicy>();
let database: Database.Database | undefined;
function db() {
  if (database) return database;
  database = new Database(":memory:");
  database.exec(
    "CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY, owner TEXT NOT NULL, body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS revisions (resume_id TEXT NOT NULL, owner TEXT NOT NULL, revision INTEGER NOT NULL, body TEXT NOT NULL, PRIMARY KEY(resume_id,revision)); CREATE TABLE IF NOT EXISTS proposals (id TEXT PRIMARY KEY, resume_id TEXT NOT NULL, owner TEXT NOT NULL, body TEXT NOT NULL);",
  );
  return database;
}
function rowBody<T>(schema: z.ZodType<T>, row: unknown): T | undefined {
  if (
    typeof row !== "object" ||
    row === null ||
    !("body" in row) ||
    typeof row.body !== "string"
  )
    return undefined;
  return schema.parse(JSON.parse(row.body));
}
export class LocalStore {
  constructor(private owner: string) {}
  async list(): Promise<ResumeSummary[]> {
    return db()
      .prepare(
        "SELECT json_remove(body,'$.source') AS body FROM documents WHERE owner=?",
      )
      .all(this.owner)
      .map((row) => rowBody(resumeSummarySchema, row))
      .filter((v): v is ResumeSummary => !!v)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }
  async get(id: string): Promise<Resume> {
    const value = rowBody(
      resumeSchema,
      db()
        .prepare("SELECT body FROM documents WHERE id=? AND owner=?")
        .get(id, this.owner),
    );
    if (!value) throw new DomainError("Resume not found", 404);
    return value;
  }
  async readEditContext(id: string) {
    const resume = await this.get(id);
    return {
      resume,
      policy:
        policies.get(`${this.owner}:${id}`) ??
        ({ mode: "review", version: 0 } satisfies AgentEditPolicy),
    };
  }
  async details(id: string) {
    return {
      ...(await this.readEditContext(id)),
      history: await this.history(id),
      proposals: await this.proposals(id),
    };
  }
  async setAgentEditPolicy(
    command: SetAgentEditPolicy,
  ): Promise<AgentEditPolicy> {
    const { policy } = await this.readEditContext(command.resumeId);
    if (policy.version !== command.expectedVersion)
      throw new DomainError("Agent permission changed", 409);
    if (policy.mode === command.mode) return policy;
    const next = agentEditPolicySchema.parse({
      mode: command.mode,
      version: policy.version + 1,
    });
    policies.set(`${this.owner}:${command.resumeId}`, next);
    return next;
  }
  private write(resume: Resume, note: string) {
    db()
      .prepare("INSERT OR REPLACE INTO documents VALUES (?,?,?)")
      .run(resume.id, this.owner, JSON.stringify(resume));
    db()
      .prepare("INSERT INTO revisions VALUES (?,?,?,?)")
      .run(
        resume.id,
        this.owner,
        resume.revision,
        JSON.stringify({ ...resume, note }),
      );
  }
  async create(input: {
    name: string;
    source: string;
    engine: Engine;
    template: string;
  }): Promise<Resume> {
    if ((await this.list()).length >= 50)
      throw new DomainError("Workspace limit is 50 resumes", 429);
    const resume = {
      ...input,
      id: randomUUID(),
      digest: digest(input.source),
      revision: 1,
      updatedAt: Date.now(),
    };
    db().transaction(() => this.write(resume, "Created from template"))();
    return resume;
  }
  async save(input: {
    id: string;
    baseDigest: string;
    expectedRevision: number;
    source: string;
    engine: Engine;
    name?: string;
    note?: string;
  }): Promise<Resume> {
    return db().transaction(() => {
      const current = rowBody(
        resumeSchema,
        db()
          .prepare("SELECT body FROM documents WHERE id=? AND owner=?")
          .get(input.id, this.owner),
      );
      if (!current) throw new DomainError("Resume not found", 404);
      if (
        current.digest !== input.baseDigest ||
        current.revision !== input.expectedRevision
      )
        throw new DomainError(
          "A newer revision exists. Reload before saving to preserve both versions.",
          409,
        );
      const next = {
        ...current,
        source: input.source,
        engine: input.engine,
        name: input.name ?? current.name,
        digest: digest(input.source),
        revision: current.revision + 1,
        updatedAt: Date.now(),
      };
      this.write(next, input.note ?? "Saved source");
      return next;
    })();
  }
  async remove(id: string) {
    await this.get(id);
    policies.delete(`${this.owner}:${id}`);
    db().transaction(() => {
      db()
        .prepare("DELETE FROM documents WHERE id=? AND owner=?")
        .run(id, this.owner);
      db()
        .prepare("DELETE FROM revisions WHERE resume_id=? AND owner=?")
        .run(id, this.owner);
      db()
        .prepare("DELETE FROM proposals WHERE resume_id=? AND owner=?")
        .run(id, this.owner);
    })();
  }
  async history(id: string): Promise<RevisionSummary[]> {
    await this.get(id);
    return db()
      .prepare(
        "SELECT json_remove(body,'$.source') AS body FROM revisions WHERE resume_id=? AND owner=? ORDER BY revision DESC LIMIT 100",
      )
      .all(id, this.owner)
      .map((row) => {
        if (
          typeof row !== "object" ||
          !row ||
          !("body" in row) ||
          typeof row.body !== "string"
        )
          throw new Error("Invalid persisted revision");
        return revisionSummarySchema.parse(JSON.parse(row.body));
      });
  }
  async revision(id: string, revision: number): Promise<Revision> {
    await this.get(id);
    const value = rowBody(
      revisionSchema,
      db()
        .prepare(
          "SELECT body FROM revisions WHERE resume_id=? AND owner=? AND revision=?",
        )
        .get(id, this.owner, revision),
    );
    if (!value) throw new DomainError("Revision not found", 404);
    return value;
  }
  async propose(command: SubmitProposal): Promise<SubmissionResult> {
    return db().transaction(() => {
      const { resumeId: id, input } = command;
      const current = rowBody(
        resumeSchema,
        db()
          .prepare("SELECT body FROM documents WHERE id=? AND owner=?")
          .get(id, this.owner),
      );
      if (!current) throw new DomainError("Resume not found", 404);
      if (
        current.digest !== input.baseDigest ||
        current.revision !== command.expectedRevision
      )
        throw new DomainError(
          "Document changed. Request a fresh proposal.",
          409,
        );
      const source = applyEdits(current.source, input.edits);
      const policy = policies.get(`${this.owner}:${id}`) ?? {
        mode: "review",
        version: 0,
      };
      const base = {
        ...input,
        id: randomUUID(),
        resumeId: id,
        createdAt: Date.now(),
      };
      if (
        policy.mode === "autonomous" &&
        policy.version === command.policyVersion &&
        !input.evidenceNeeded.length
      ) {
        const proposal = { ...base, status: "accepted" } satisfies Proposal;
        const resume = {
          ...current,
          source,
          digest: digest(source),
          revision: current.revision + 1,
          updatedAt: Date.now(),
        };
        this.write(resume, `Accepted: ${proposal.title}`);
        db()
          .prepare("INSERT INTO proposals VALUES (?,?,?,?)")
          .run(proposal.id, id, this.owner, JSON.stringify(proposal));
        return { kind: "applied", proposal, resume } satisfies SubmissionResult;
      }
      const proposal = { ...base, status: "pending" } satisfies Proposal;
      db()
        .prepare("INSERT INTO proposals VALUES (?,?,?,?)")
        .run(proposal.id, id, this.owner, JSON.stringify(proposal));
      return { kind: "proposal", proposal } satisfies SubmissionResult;
    })();
  }
  async proposals(id: string): Promise<Proposal[]> {
    await this.get(id);
    return db()
      .prepare("SELECT body FROM proposals WHERE resume_id=? AND owner=?")
      .all(id, this.owner)
      .map((row) => rowBody(proposalSchema, row))
      .filter((v): v is Proposal => !!v);
  }
  async decide(
    id: string,
    proposalId: string,
    accept: boolean,
  ): Promise<Resume> {
    return db().transaction(() => {
      const current = rowBody(
        resumeSchema,
        db()
          .prepare("SELECT body FROM documents WHERE id=? AND owner=?")
          .get(id, this.owner),
      );
      const proposal = rowBody(
        proposalSchema,
        db()
          .prepare(
            "SELECT body FROM proposals WHERE id=? AND resume_id=? AND owner=?",
          )
          .get(proposalId, id, this.owner),
      );
      if (!current || !proposal)
        throw new DomainError("Proposal not found", 404);
      if (proposal.status !== "pending")
        throw new DomainError("Proposal already reviewed", 409);
      if (accept) {
        if (proposal.evidenceNeeded.length)
          throw new DomainError(
            "Resolve the proposal's evidence requirements before applying it",
            422,
          );
        if (current.digest !== proposal.baseDigest)
          throw new DomainError(
            "This proposal is stale. Request it again against the current source.",
            409,
          );
        const source = applyEdits(current.source, proposal.edits);
        const next = {
          ...current,
          source,
          digest: digest(source),
          revision: current.revision + 1,
          updatedAt: Date.now(),
        };
        this.write(next, `Accepted: ${proposal.title}`);
        proposal.status = "accepted";
        db()
          .prepare("UPDATE proposals SET body=? WHERE id=?")
          .run(JSON.stringify(proposal), proposalId);
        return next;
      }
      proposal.status = "rejected";
      db()
        .prepare("UPDATE proposals SET body=? WHERE id=?")
        .run(JSON.stringify(proposal), proposalId);
      return current;
    })();
  }
}
