import {
  resumeSchema,
  resumeSummarySchema,
  revisionSchema,
  proposalSchema,
  revisionSummarySchema,
} from "../core/schemas";
import { z } from "zod";
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  applyEdits,
  DomainError,
  type Engine,
  type Proposal,
  type ProposalInput,
  type Resume,
  type Revision,
  type RevisionSummary,
  type ResumeSummary,
} from "../core/model";
import { digest } from "../core/digest";
let database: Database.Database | undefined;
function db() {
  if (database) return database;
  const root = process.env.DATA_DIR ?? join(process.cwd(), ".data");
  mkdirSync(root, { recursive: true, mode: 0o700 });
  database = new Database(join(root, "workspace.sqlite"));
  database.pragma("journal_mode = WAL");
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
  async propose(id: string, input: ProposalInput): Promise<Proposal> {
    const current = await this.get(id);
    if (current.digest !== input.baseDigest)
      throw new DomainError("Document changed. Request a fresh proposal.", 409);
    applyEdits(current.source, input.edits);
    const proposal: Proposal = {
      ...input,
      id: randomUUID(),
      resumeId: id,
      status: "pending",
      createdAt: Date.now(),
    };
    db()
      .prepare("INSERT INTO proposals VALUES (?,?,?,?)")
      .run(proposal.id, id, this.owner, JSON.stringify(proposal));
    return proposal;
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
