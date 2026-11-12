"use client";
import Link from "next/link";
import { reconcileProposals } from "@/lib/client/proposals";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  FileText,
  Plus,
  ArrowLeft,
  Play,
  Download,
  Undo2,
  Redo2,
  Search,
  History,
  PanelRightClose,
  PanelRightOpen,
  Sparkles,
  Check,
  AlertCircle,
  Trash2,
  Pencil,
  Command,
  ChevronRight,
  LayoutGrid,
  Files,
  Braces,
  LoaderCircle,
  CheckCheck,
  BookOpen,
} from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import { useTheme } from "@/lib/client/theme";
import { ThemeSelect } from "./theme-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { SourceEditor, type EditorHandle } from "./source-editor";
import { PdfPreview } from "./pdf-preview";
import { api } from "@/lib/client/api";
import { templates } from "@/lib/core/templates";
import {
  resumeSchema,
  resumeSummarySchema,
  compileSchema,
  atsSchema,
} from "@/lib/core/schemas";
import type {
  Engine,
  Proposal,
  Resume,
  ResumeSummary,
  RevisionSummary,
} from "@/lib/core/model";
import type { CompileResult } from "@/lib/server/compiler";
import type { AtsReport } from "@/lib/core/ats";
import type { ToolCall } from "@/lib/server/tools";
import {
  agentEditModeSchema,
  agentEditPolicySchema,
  submissionResultSchema,
  workspaceDetailsSchema,
  type AgentEditPolicy,
} from "@/lib/core/agent-policy";
import { classifyResumeHead } from "@/lib/client/resume-head";
type DraftConflict =
  { kind: "changed"; resume: Resume } | { kind: "unconfirmed" };
const documentResponse = z.object({ resume: resumeSchema });
const detailResponse = workspaceDetailsSchema;
const assistantResponse = z.union([
  submissionResultSchema.and(z.object({ provider: z.string() })),
  z.object({
    kind: z.literal("document"),
    resume: resumeSchema,
    policy: agentEditPolicySchema,
    provider: z.string(),
  }),
]);
type Modal =
  "gallery" | "history" | "rename" | "delete" | "commands" | "evidence" | null;
type MobileView = "source" | "pdf" | "agent" | "ats";
function IconButton({
  label,
  children,
  onClick,
  disabled,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={label}
          onClick={onClick}
          disabled={disabled}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
export function Workspace() {
  const { dark } = useTheme();
  const [resumes, setResumes] = useState<ResumeSummary[]>([]);
  const [active, setActive] = useState<Resume | null>(null);
  const [source, setSource] = useState("");
  const [engine, setEngine] = useState<Engine>("pdflatex");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modal, setModalState] = useState<Modal>(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState("");
  const [history, setHistory] = useState<RevisionSummary[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [agentPolicy, setAgentPolicy] = useState<AgentEditPolicy>({
    mode: "review",
    version: 0,
  });
  const policyRef = useRef(agentPolicy);
  const [policySaving, setPolicySaving] = useState(false);
  const policyRequest = useRef<{ id: string; session: number } | null>(null);
  const deferredHead = useRef<Resume | null>(null);
  const [draftConflict, setDraftConflict] = useState<DraftConflict | null>(
    null,
  );
  const conflictRef = useRef<DraftConflict | null>(null);
  const loadingDocument = useRef(false);
  const setConflict = useCallback((conflict: DraftConflict | null) => {
    conflictRef.current = conflict;
    setDraftConflict(conflict);
  }, []);
  const [compileResult, setCompileResult] = useState<CompileResult | null>(
    null,
  );
  const [artifact, setArtifact] = useState<{
    id: string;
    digest: string;
    engine: Engine;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [applying, setApplyingState] = useState(false);
  const applyingRef = useRef(false);
  const [saveState, setSaveState] = useState<
    "saved" | "unsaved" | "saving" | "error"
  >("saved");
  const [panel, setPanel] = useState<"agent" | "ats" | null>("agent");
  const [mobileView, setMobileView] = useState<MobileView>("source");
  const [showLog, setShowLog] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [agentBusy, setAgentBusy] = useState(false);
  const [agentMessage, setAgentMessage] = useState("");
  const [job, setJob] = useState("");
  const [ats, setAts] = useState<AtsReport | null>(null);
  const [atsBusy, setAtsBusy] = useState(false);
  const [split, setSplit] = useState(49);
  const [commandQuery, setCommandQuery] = useState("");
  const [verifiedEvidence, setVerifiedEvidence] = useState("");
  const [evidenceRange, setEvidenceRange] = useState<{
    start: number;
    end: number;
    expected: string;
  } | null>(null);
  const [dashboardTab, setDashboardTab] = useState("resumes");
  const dialogOpener = useRef<HTMLElement | null>(null);
  const findAfterClose = useRef(false);
  const setModal = useCallback((next: Modal) => {
    if (
      next &&
      !dialogOpener.current &&
      document.activeElement instanceof HTMLElement
    )
      dialogOpener.current = document.activeElement;
    setModalState(next);
  }, []);
  const documentSession = useRef(0);
  const editor = useRef<EditorHandle>(null);
  const activeRef = useRef(active);
  const setApplying = useCallback((value: boolean) => {
    applyingRef.current = value;
    setApplyingState(value);
    editor.current?.setReadOnly(value);
  }, []);
  const draftRef = useRef({ source, engine });
  const savePromise = useRef<Promise<Resume | null> | null>(null);
  const compileSequence = useRef(0);
  const workspace = useRef<HTMLDivElement>(null);
  const pending = proposals.filter((proposal) => proposal.status === "pending");
  const dirty =
    !!active && (source !== active.source || engine !== active.engine);
  const pdfStale =
    !!artifact &&
    (artifact.digest !== active?.digest || dirty || artifact.engine !== engine);
  const isCurrent = (id: string, session: number) =>
    activeRef.current?.id === id && documentSession.current === session;
  const report = useCallback((reason: unknown) => {
    setError(reason instanceof Error ? reason.message : "Operation failed");
  }, []);
  const refresh = useCallback(async () => {
    try {
      setResumes(
        (
          await api(
            "/api/workspace",
            z.object({ resumes: z.array(resumeSummarySchema) }),
          )
        ).resumes,
      );
      setError("");
    } catch (reason) {
      report(reason);
    } finally {
      setLoading(false);
    }
  }, [report]);
  useEffect(
    () => () => {
      documentSession.current += 1;
      compileSequence.current += 1;
      activeRef.current = null;
    },
    [],
  );
  useEffect(() => {
    queueMicrotask(() => void refresh());
  }, [refresh]);
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", unload);
    return () => window.removeEventListener("beforeunload", unload);
  }, [dirty]);
  const compileDocument = useCallback(
    async (doc: Resume) => {
      const sequence = ++compileSequence.current;
      const session = documentSession.current;
      setBusy(true);
      try {
        const result = await api("/api/compile", compileSchema, { id: doc.id });
        if (
          sequence !== compileSequence.current ||
          session !== documentSession.current ||
          activeRef.current?.id !== doc.id ||
          activeRef.current.revision !== doc.revision ||
          activeRef.current.digest !== doc.digest ||
          activeRef.current.engine !== doc.engine ||
          result.revision !== doc.revision ||
          result.digest !== doc.digest ||
          result.engine !== doc.engine
        )
          return;
        setCompileResult(result);
        if (result.ok)
          setArtifact({
            id: result.artifact,
            digest: result.digest,
            engine: result.engine,
          });
        else {
          setShowLog(true);
          setNotice(
            "Compilation failed. Your last successful PDF is still available.",
          );
        }
      } catch (reason) {
        report(reason);
      } finally {
        if (sequence === compileSequence.current) setBusy(false);
      }
    },
    [report],
  );
  const reconcileHead = useCallback(
    (incoming: Resume | null) => {
      const baseline = activeRef.current;
      if (!baseline || !incoming || incoming.id !== baseline.id) return;
      if (
        deferredHead.current &&
        deferredHead.current.revision > incoming.revision
      )
        return;
      const outcome = classifyResumeHead({
        baseline,
        draft: draftRef.current,
        incoming,
        busy: !!savePromise.current || applyingRef.current,
      });
      if (outcome === "ignore") {
        if (
          deferredHead.current &&
          deferredHead.current.revision <= baseline.revision
        )
          deferredHead.current = null;
        return;
      }
      deferredHead.current = incoming;
      if (outcome === "defer") return;
      if (outcome === "conflict") {
        setConflict({ kind: "changed", resume: incoming });
        setSaveState("error");
        return;
      }
      deferredHead.current = null;
      setConflict(null);
      activeRef.current = incoming;
      setActive(incoming);
      if (outcome === "metadata") return;
      draftRef.current = { source: incoming.source, engine: incoming.engine };
      setSource(incoming.source);
      setEngine(incoming.engine);
      setSaveState("saved");
      setAts(null);
      setCompileResult(null);
      setError("");
      setNotice("Saved changes synced.");
      void compileDocument(incoming);
    },
    [compileDocument, setConflict],
  );
  const reloadDetails = useCallback(
    async (id: string) => {
      const session = documentSession.current;
      const detail = await api(
        `/api/workspace?id=${encodeURIComponent(id)}`,
        detailResponse,
      );
      if (session === documentSession.current && activeRef.current?.id === id) {
        if (detail.policy.version >= policyRef.current.version) {
          policyRef.current = detail.policy;
          setAgentPolicy(detail.policy);
        }
        if (
          detail.resume.revision >=
          Math.max(
            activeRef.current.revision,
            deferredHead.current?.revision ?? 0,
          )
        )
          setHistory(detail.history);
        setProposals((current) =>
          reconcileProposals(current, detail.proposals),
        );
        reconcileHead(detail.resume);
      }
      return detail;
    },
    [reconcileHead],
  );
  const save = useCallback(
    async (forceCompile = true): Promise<Resume | null> => {
      if (conflictRef.current) return null;
      if (savePromise.current) {
        await savePromise.current;
      }
      if (conflictRef.current) return null;
      const doc = activeRef.current;
      if (!doc) return null;
      const draft = { ...draftRef.current };
      const session = documentSession.current;
      if (draft.source === doc.source && draft.engine === doc.engine) {
        if (forceCompile) await compileDocument(doc);
        return doc;
      }
      const action = (async () => {
        setSaveState("saving");
        try {
          const result = await api("/api/workspace", documentResponse, {
            op: "save",
            id: doc.id,
            baseDigest: doc.digest,
            expectedRevision: doc.revision,
            source: draft.source,
            engine: draft.engine,
          });
          if (
            activeRef.current?.id !== doc.id ||
            documentSession.current !== session
          )
            return null;
          if (activeRef.current.revision > result.resume.revision)
            return activeRef.current;
          activeRef.current = result.resume;
          setActive(result.resume);
          setSaveState(
            draftRef.current.source === draft.source &&
              draftRef.current.engine === draft.engine
              ? "saved"
              : "unsaved",
          );
          await reloadDetails(doc.id);
          if (forceCompile) await compileDocument(result.resume);
          return result.resume;
        } catch (reason) {
          if (
            activeRef.current?.id === doc.id &&
            documentSession.current === session
          ) {
            setSaveState("error");
            setConflict({ kind: "unconfirmed" });
            report(reason);
            try {
              await reloadDetails(doc.id);
            } catch (refreshError) {
              report(refreshError);
            }
          }
          return null;
        }
      })();
      savePromise.current = action;
      try {
        return await action;
      } finally {
        savePromise.current = null;
        if (documentSession.current === session)
          reconcileHead(deferredHead.current);
      }
    },
    [compileDocument, reloadDetails, report, reconcileHead, setConflict],
  );
  const saveLatest = useRef(save);
  useEffect(() => {
    saveLatest.current = save;
  }, [save]);
  useEffect(() => {
    if (!active || !dirty || applying || draftConflict) return;
    const timer = setTimeout(() => {
      void saveLatest.current(true);
    }, 1100);
    return () => clearTimeout(timer);
  }, [source, engine, active, dirty, applying, draftConflict]);
  const loadDocument = useCallback(
    async (id: string, draftAction: "save" | "discard" = "save") => {
      if (applyingRef.current) return;
      let session = documentSession.current;
      setApplying(true);
      loadingDocument.current = true;
      try {
        if (
          draftAction === "save" &&
          activeRef.current &&
          !(await saveLatest.current(false))
        )
          return;
        session = ++documentSession.current;
        const detail = await reloadDetails(id);
        if (session !== documentSession.current) return;
        const doc = detail.resume;
        policyRef.current = detail.policy;
        setAgentPolicy(detail.policy);
        policyRequest.current = null;
        setPolicySaving(false);
        deferredHead.current = null;
        setConflict(null);
        setHistory(detail.history);
        setProposals(detail.proposals);
        setAgentBusy(false);
        setAtsBusy(false);
        setAgentMessage("");
        activeRef.current = doc;
        draftRef.current = { source: doc.source, engine: doc.engine };
        setActive(doc);
        setSource(doc.source);
        setEngine(doc.engine);
        setArtifact(null);
        setCompileResult(null);
        setAts(null);
        setError("");
        setNotice("");
        setSaveState("saved");
        setMobileView("source");
        void compileDocument(doc);
      } catch (reason) {
        if (session === documentSession.current) report(reason);
      } finally {
        if (session === documentSession.current) {
          loadingDocument.current = false;
          setApplying(false);
          reconcileHead(deferredHead.current);
        }
      }
    },
    [
      compileDocument,
      reloadDetails,
      report,
      setApplying,
      reconcileHead,
      setConflict,
    ],
  );
  const changeSource = (value: string) => {
    if (applyingRef.current) return;
    setSource(value);
    draftRef.current = { source: value, engine: draftRef.current.engine };
    setSaveState("unsaved");
  };
  const goHome = async () => {
    if (activeRef.current && !(await save(false))) return;
    const baseline = activeRef.current;
    if (
      baseline &&
      (conflictRef.current ||
        draftRef.current.source !== baseline.source ||
        draftRef.current.engine !== baseline.engine)
    ) {
      setNotice("Your latest edits are still saving. Try again when saved.");
      return;
    }
    setApplying(false);
    loadingDocument.current = false;
    compileSequence.current++;
    documentSession.current++;
    activeRef.current = null;
    setActive(null);
    setArtifact(null);
    setCompileResult(null);
    setBusy(false);
    await refresh();
  };
  const create = async (templateId: string) => {
    if (conflictRef.current) return;
    setCreating(templateId);
    try {
      const template = templates.find((t) => t.id === templateId);
      const result = await api("/api/workspace", documentResponse, {
        op: "create",
        template: templateId,
        name: `${template?.name ?? "My"} resume`,
      });
      setModal(null);
      await refresh();
      await loadDocument(result.resume.id);
    } catch (reason) {
      report(reason);
    } finally {
      setCreating("");
    }
  };
  const mutateName = async () => {
    const session = documentSession.current;
    const doc = await save(false);
    if (!doc || !isCurrent(doc.id, session)) return;
    try {
      const result = await api("/api/workspace", documentResponse, {
        op: "save",
        id: doc.id,
        baseDigest: doc.digest,
        expectedRevision: doc.revision,
        source: doc.source,
        engine: doc.engine,
        name,
      });
      if (!isCurrent(doc.id, session)) return;
      reconcileHead(result.resume);
      setModal(null);
      await refresh();
    } catch (reason) {
      if (isCurrent(doc.id, session)) report(reason);
    }
  };
  const remove = async () => {
    if (!active) return;
    const session = documentSession.current;
    const id = active.id;
    try {
      await api("/api/workspace", z.object({ ok: z.boolean() }), {
        op: "delete",
        id: active.id,
      });
      if (!isCurrent(id, session)) return;
      documentSession.current++;
      activeRef.current = null;
      setActive(null);
      setModal(null);
      setArtifact(null);
      await refresh();
    } catch (reason) {
      report(reason);
    }
  };
  const restore = async (revision: number) => {
    if (applyingRef.current) return;
    const session = documentSession.current;
    setApplying(true);
    try {
      const doc = await save(false);
      if (!doc || !isCurrent(doc.id, session)) return;
      const result = await api("/api/workspace", documentResponse, {
        op: "restore",
        id: doc.id,
        revision,
        expectedRevision: doc.revision,
        baseDigest: doc.digest,
      });
      if (!isCurrent(doc.id, session)) return;
      activeRef.current = result.resume;
      draftRef.current = {
        source: result.resume.source,
        engine: result.resume.engine,
      };
      setActive(result.resume);
      setSource(result.resume.source);
      setEngine(result.resume.engine);
      setSaveState("saved");
      await reloadDetails(doc.id);
      setModal(null);
      setNotice(
        `Revision ${revision} restored as new revision ${result.resume.revision}.`,
      );
      await compileDocument(result.resume);
    } catch (reason) {
      if (session === documentSession.current) report(reason);
    } finally {
      if (session === documentSession.current) {
        setApplying(false);
        reconcileHead(deferredHead.current);
      }
    }
  };
  const changeAgentPolicy = async (mode: AgentEditPolicy["mode"]) => {
    const id = activeRef.current?.id;
    if (!id || policyRequest.current || mode === policyRef.current.mode) return;
    const request = { id, session: documentSession.current };
    policyRequest.current = request;
    setPolicySaving(true);
    try {
      const result = await api(
        "/api/workspace",
        z.object({ policy: agentEditPolicySchema }),
        {
          op: "agent_policy",
          resumeId: id,
          mode,
          expectedVersion: policyRef.current.version,
        },
      );
      if (!isCurrent(id, request.session)) return;
      if (result.policy.version >= policyRef.current.version) {
        policyRef.current = result.policy;
        setAgentPolicy(result.policy);
      }
      await reloadDetails(id);
    } catch (reason) {
      if (isCurrent(id, request.session)) {
        report(reason);
        try {
          await reloadDetails(id);
        } catch (refreshError) {
          report(refreshError);
        }
      }
    } finally {
      if (policyRequest.current === request) {
        policyRequest.current = null;
        setPolicySaving(false);
      }
    }
  };
  const askAgent = async (
    call?: ToolCall,
    prompt?: string,
    verifiedEvidence?: string,
  ) => {
    if (applyingRef.current) return;
    const session = documentSession.current;
    const doc = await save(false);
    if (!doc || !isCurrent(doc.id, session)) return;
    setAgentBusy(true);
    setPanel("agent");
    setMobileView("agent");
    setAgentMessage("");
    setError("");
    try {
      const result = await api("/api/agent", assistantResponse, {
        id: doc.id,
        baseDigest: doc.digest,
        instruction: prompt ?? instruction,
        jobDescription: job,
        log: compileResult?.log ?? "",
        call,
        verifiedEvidence,
      });
      if (!isCurrent(doc.id, session)) return;
      if (result.kind === "proposal" || result.kind === "applied") {
        setProposals((current) =>
          reconcileProposals(current, [result.proposal]),
        );
        if (result.kind === "applied") {
          reconcileHead(result.resume);
          setAgentMessage(`Applied: ${result.proposal.title}`);
          await reloadDetails(doc.id);
        }
      } else {
        if (result.policy.version >= policyRef.current.version) {
          policyRef.current = result.policy;
          setAgentPolicy(result.policy);
        }
        setAgentMessage(
          `Read revision ${result.resume.revision}. Source has ${result.resume.source.split("\n").length} lines. Add factual evidence in the editor, then request a targeted change.`,
        );
      }
    } catch (reason) {
      if (isCurrent(doc.id, session)) report(reason);
    } finally {
      if (isCurrent(doc.id, session)) setAgentBusy(false);
    }
  };
  const decide = async (proposal: Proposal, accept: boolean) => {
    if (applyingRef.current) return;
    const session = documentSession.current;
    setApplying(true);
    try {
      const doc = await save(false);
      if (!doc || !isCurrent(doc.id, session)) return;
      const result = await api("/api/workspace", documentResponse, {
        op: "decide",
        id: doc.id,
        proposalId: proposal.id,
        accept,
      });
      if (!isCurrent(doc.id, session)) return;
      setProposals((current) =>
        reconcileProposals(current, [
          { ...proposal, status: accept ? "accepted" : "rejected" },
        ]),
      );
      if (accept) {
        activeRef.current = result.resume;
        draftRef.current = {
          source: result.resume.source,
          engine: result.resume.engine,
        };
        setActive(result.resume);
        setSource(result.resume.source);
        setEngine(result.resume.engine);
        setSaveState("saved");
        setNotice(
          "Proposal accepted. Use Undo proposal to restore its previous revision.",
        );
        await compileDocument(result.resume);
      }
      await reloadDetails(doc.id);
    } catch (reason) {
      if (session === documentSession.current) report(reason);
    } finally {
      if (session === documentSession.current) {
        setApplying(false);
        reconcileHead(deferredHead.current);
      }
    }
  };
  const runAts = async () => {
    if (applyingRef.current) return;
    const session = documentSession.current;
    const doc = await save(false);
    if (!doc || !isCurrent(doc.id, session)) return;
    setAtsBusy(true);
    setPanel("ats");
    setMobileView("ats");
    setError("");
    try {
      const result = await api("/api/ats", atsSchema, {
        id: doc.id,
        jobDescription: job,
      });
      if (!isCurrent(doc.id, session)) return;
      if (activeRef.current?.revision !== result.revision) {
        setNotice("The source changed during analysis. Run the check again.");
        return;
      }
      setAts(result);
    } catch (reason) {
      if (isCurrent(doc.id, session)) report(reason);
    } finally {
      if (isCurrent(doc.id, session)) setAtsBusy(false);
    }
  };
  const fixFinding = (fix: string) => {
    if (applyingRef.current) return;
    if (fix === "columns") {
      void askAgent({ tool: "flatten_columns" });
      return;
    }
    if (fix === "impact") {
      const from = Math.max(0, source.indexOf("\\begin{document}"));
      const match = source
        .slice(from)
        .match(/\\resumeItem\{([^\n}]+)\}|\\item\s+([^\n]+)/);
      const expected = match?.[1] ?? match?.[2];
      if (match && match.index !== undefined && expected) {
        const start = from + match.index + match[0].indexOf(expected);
        setEvidenceRange({ start, end: start + expected.length, expected });
        setVerifiedEvidence("");
        setModal("evidence");
      } else {
        setAgentMessage(
          "Select a bullet in the editor and add a verified outcome to its source before requesting a rewrite.",
        );
        setPanel("agent");
        setMobileView("agent");
      }
      return;
    }
    const missing = ["Experience", "Education", "Skills"].find(
      (heading) =>
        !new RegExp(`\\\\section\\*?\\{${heading}\\}`, "i").test(source),
    );
    if (missing) {
      const aliases: Record<string, string[]> = {
        Skills: ["Toolbox", "Technologies", "Technical expertise"],
        Experience: ["Work", "Employment history"],
        Education: ["Studies", "Academic background"],
      };
      const existing = (aliases[missing] ?? [])
        .map((alias) => ({ alias, token: `\\section{${alias}}` }))
        .find((candidate) => source.includes(candidate.token));
      if (existing) {
        const start = source.indexOf(existing.token);
        void askAgent({
          tool: "range_patch",
          title: `Use a recognizable ${missing} heading`,
          edits: [
            {
              start,
              end: start + existing.token.length,
              expected: existing.token,
              replacement: `\\section{${missing}}`,
            },
          ],
        });
      } else
        void askAgent({
          tool: "insert_section",
          heading: missing,
          content: "[Add your verified details here.]",
        });
    } else {
      setAgentMessage(
        "Your source headings exist. Inspect What ATS sees for layout or extraction issues before changing content.",
      );
      setPanel("agent");
      setMobileView("agent");
    }
  };
  const downloadSource = () => {
    const url = URL.createObjectURL(
      new Blob([source], { type: "application/x-tex" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "resume.tex";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const commands = [
    "Save and compile",
    "Find in source",
    "Version history",
    "Download LaTeX source",
    "Run ATS analysis",
    "New resume from template",
  ];
  const runCommand = (name: string) => {
    switch (name) {
      case "Save and compile":
        if (!applyingRef.current) void save(true);
        break;
      case "Find in source":
        setMobileView("source");
        findAfterClose.current = true;
        break;
      case "Version history":
        setModal("history");
        break;
      case "Download LaTeX source":
        downloadSource();
        break;
      case "Run ATS analysis":
        void runAts();
        break;
      case "New resume from template":
        setModal("gallery");
        break;
    }
  };
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setModal("commands");
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (!applyingRef.current) void saveLatest.current(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setModal]);
  const activeId = active?.id;
  useEffect(() => {
    if (!activeId) return;
    let disposed = false;
    let pending = false;
    const interval = setInterval(() => {
      if (pending || loadingDocument.current) return;
      pending = true;
      void reloadDetails(activeId)
        .catch((reason) => {
          if (!disposed && activeRef.current?.id === activeId) report(reason);
        })
        .finally(() => {
          pending = false;
        });
    }, 12_000);
    return () => {
      disposed = true;
      clearInterval(interval);
    };
  }, [activeId, reloadDetails, report]);
  const resize = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const element = workspace.current;
    if (!element) return;
    const move = (pointer: PointerEvent) => {
      const rect = element.getBoundingClientRect();
      setSplit(
        Math.max(
          30,
          Math.min(70, ((pointer.clientX - rect.left) / rect.width) * 100),
        ),
      );
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
  };
  const jumpText = (text: string) => {
    const plain = text.trim();
    if (!plain) return;
    const index = source.indexOf(plain);
    if (index >= 0) {
      setMobileView("source");
      editor.current?.jump(source.slice(0, index).split("\n").length);
    } else
      setNotice(
        "No exact source match for that PDF text. Commands and ligatures can change its representation.",
      );
  };
  const themeButton = <ThemeSelect />;
  return (
    <TooltipProvider>
      <div className={`app-shell ${active ? "is-editing" : ""}`}>
        {!active && (
          <aside className="dashboard-sidebar">
            <Link className="brand" href="/" aria-label="Resume TeX home">
              <span className="brand-mark">
                R<span>τ</span>
              </span>
              <strong>Resume TeX</strong>
            </Link>
            <nav>
              <button
                className={dashboardTab === "resumes" ? "selected" : ""}
                onClick={() => setDashboardTab("resumes")}
              >
                <Files size={18} />
                My resumes<span>{resumes.length}</span>
              </button>
              <button
                className={dashboardTab === "templates" ? "selected" : ""}
                onClick={() => setDashboardTab("templates")}
              >
                <LayoutGrid size={18} />
                Templates
              </button>
            </nav>
            <div className="sidebar-bottom">
              <div className="account-row">
                {themeButton}
                <UserButton />
              </div>
            </div>
          </aside>
        )}
        <main className="main-area">
          {active ? (
            <>
              <header className="editor-header">
                <div className="document-identity">
                  <IconButton
                    label="Back to resumes"
                    onClick={() => void goHome()}
                  >
                    <ArrowLeft size={18} />
                  </IconButton>
                  <span className="brand-mark small">
                    R<span>τ</span>
                  </span>
                  <button
                    className="document-name"
                    onClick={() => {
                      setName(active.name);
                      setModal("rename");
                    }}
                  >
                    {active.name}
                    <Pencil size={12} />
                  </button>
                  <span className={`save-status ${saveState}`}>
                    {saveState === "saving" ? (
                      <LoaderCircle size={12} className="spin" />
                    ) : saveState === "saved" && !dirty ? (
                      <CheckCheck size={13} />
                    ) : (
                      <span className="status-dot" />
                    )}
                    {saveState === "error"
                      ? "Save failed"
                      : dirty
                        ? "Unsaved changes"
                        : saveState === "saving"
                          ? "Saving…"
                          : "All changes saved"}
                  </span>
                </div>
                <div className="editor-actions">
                  <IconButton
                    label="Command menu (Ctrl+K)"
                    onClick={() => {
                      setCommandQuery("");
                      setModal("commands");
                    }}
                  >
                    <Command size={17} />
                  </IconButton>
                  <IconButton
                    label="Version history"
                    onClick={() => {
                      void reloadDetails(active.id);
                      setModal("history");
                    }}
                  >
                    <History size={17} />
                  </IconButton>
                  {themeButton}
                  <Button
                    aria-label={busy ? "Compiling…" : "Compile"}
                    className="compile-button"
                    onClick={() => void save(true)}
                    disabled={applying || busy || saveState === "saving"}
                  >
                    {busy ? (
                      <LoaderCircle size={14} className="spin" />
                    ) : (
                      <Play size={14} />
                    )}
                    <span>{busy ? "Compiling…" : "Compile"}</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    disabled={!artifact}
                  >
                    <a
                      href={artifact ? `/api/pdf/${artifact.id}` : undefined}
                      download="resume.pdf"
                      aria-disabled={!artifact}
                    >
                      <Download size={14} />
                      <span>PDF</span>
                    </a>
                  </Button>
                </div>
              </header>
              <div
                className="mobile-tabs"
                role="tablist"
                aria-label="Workspace view"
              >
                {(["source", "pdf", "agent", "ats"] satisfies MobileView[]).map(
                  (view) => (
                    <button
                      role="tab"
                      aria-selected={mobileView === view}
                      key={view}
                      onClick={() => {
                        setMobileView(view);
                        if (view === "agent" || view === "ats") setPanel(view);
                      }}
                    >
                      {view === "source"
                        ? "LaTeX"
                        : view === "pdf"
                          ? "PDF"
                          : view === "agent"
                            ? "Assistant"
                            : "ATS check"}
                      {view === "agent" && pending.length > 0 && (
                        <span>{pending.length}</span>
                      )}
                    </button>
                  ),
                )}
              </div>
              {(error || notice) && (
                <div
                  className={error ? "message error" : "message"}
                  role={error ? "alert" : "status"}
                >
                  <AlertCircle size={15} />
                  <span>{error || notice}</span>
                  <button
                    aria-label="Dismiss message"
                    onClick={() => {
                      setError("");
                      setNotice("");
                    }}
                  >
                    ×
                  </button>
                </div>
              )}
              {draftConflict && (
                <div className="draft-conflict" role="alert">
                  <p>
                    {draftConflict.kind === "changed"
                      ? "Saved resume changed. Your draft is preserved."
                      : "Save could not be confirmed. Your draft is preserved."}
                  </p>
                  <Button variant="outline" size="sm" onClick={downloadSource}>
                    Download draft
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={applying || saveState === "saving"}
                    onClick={() => void loadDocument(active.id, "discard")}
                  >
                    Discard draft and load saved
                  </Button>
                </div>
              )}
              <div
                className={`editor-body panel-${panel ?? "closed"} mobile-${mobileView}`}
              >
                <div
                  className="document-workspace"
                  ref={workspace}
                  style={
                    { "--source-width": `${split}%` } as React.CSSProperties
                  }
                >
                  <section className="source-pane">
                    <div className="pane-toolbar">
                      <span>
                        <Braces size={15} />
                        resume.tex
                      </span>
                      <div>
                        <IconButton
                          label="Undo source edit"
                          disabled={applying}
                          onClick={() => editor.current?.undo()}
                        >
                          <Undo2 size={14} />
                        </IconButton>
                        <IconButton
                          label="Redo source edit"
                          disabled={applying}
                          onClick={() => editor.current?.redo()}
                        >
                          <Redo2 size={14} />
                        </IconButton>
                        <IconButton
                          label="Find in source"
                          onClick={() => editor.current?.find()}
                        >
                          <Search size={14} />
                        </IconButton>
                        <select
                          aria-label="LaTeX engine"
                          disabled={applying}
                          value={engine}
                          onChange={(event) => {
                            const next =
                              event.target.value === "xelatex"
                                ? "xelatex"
                                : "pdflatex";
                            setEngine(next);
                            draftRef.current = {
                              source: draftRef.current.source,
                              engine: next,
                            };
                            setSaveState("unsaved");
                          }}
                        >
                          <option value="pdflatex">pdfLaTeX</option>
                          <option value="xelatex">XeLaTeX</option>
                        </select>
                      </div>
                    </div>
                    <SourceEditor
                      key={active.id}
                      ref={editor}
                      value={source}
                      onChange={changeSource}
                      onSave={() => {
                        if (!applyingRef.current) void save(true);
                      }}
                      dark={dark}
                      diagnostics={compileResult?.diagnostics ?? []}
                      edits={pending
                        .filter((p) => p.baseDigest === active.digest && !dirty)
                        .flatMap((p) => p.edits)}
                    />
                    <footer className="source-footer">
                      <span>
                        {applying ? "Applying changes…" : "LaTeX · UTF-8"}
                      </span>
                      <button onClick={() => setShowLog((value) => !value)}>
                        {compileResult && !compileResult.ok ? (
                          <>
                            <AlertCircle size={12} />
                            Compile errors
                          </>
                        ) : (
                          <>
                            Compile log
                            {compileResult?.diagnostics.length
                              ? ` (${compileResult.diagnostics.length})`
                              : ""}
                          </>
                        )}
                        <ChevronRight size={12} />
                      </button>
                    </footer>
                    {showLog && (
                      <div className="compile-log">
                        <div className="log-title">
                          <strong>Compilation diagnostics</strong>
                          <button
                            onClick={() => setShowLog(false)}
                            aria-label="Close compile log"
                          >
                            ×
                          </button>
                        </div>
                        {compileResult?.diagnostics.map((diagnostic, index) => (
                          <button
                            className="diagnostic"
                            key={index}
                            onClick={() =>
                              editor.current?.jump(diagnostic.line)
                            }
                          >
                            <span>
                              Line {diagnostic.line}:{diagnostic.column}
                            </span>
                            {diagnostic.message}
                          </button>
                        ))}
                        {compileResult && !compileResult.ok && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={applying || agentBusy || !!draftConflict}
                            onClick={() =>
                              void askAgent({
                                tool: "fix_compile_error",
                                log: compileResult.log,
                              })
                            }
                          >
                            Propose a fix
                          </Button>
                        )}
                        <pre>
                          {compileResult?.log ??
                            "Compile to see engine output."}
                        </pre>
                      </div>
                    )}
                  </section>
                  <div
                    className="splitter"
                    role="separator"
                    aria-label="Resize source and PDF"
                    aria-orientation="vertical"
                    aria-valuenow={Math.round(split)}
                    aria-valuemin={30}
                    aria-valuemax={70}
                    tabIndex={0}
                    onPointerDown={resize}
                    onKeyDown={(event) => {
                      if (
                        event.key === "ArrowLeft" ||
                        event.key === "ArrowRight"
                      ) {
                        event.preventDefault();
                        setSplit((value) =>
                          Math.max(
                            30,
                            Math.min(
                              70,
                              value + (event.key === "ArrowRight" ? 2 : -2),
                            ),
                          ),
                        );
                      }
                    }}
                  >
                    <span />
                  </div>
                  <section className="pdf-pane">
                    <div className="pane-toolbar">
                      <span>
                        <FileText size={15} />
                        PDF preview
                        {pdfStale && (
                          <Badge variant="secondary">Out of date</Badge>
                        )}
                      </span>
                      <div>
                        <IconButton
                          label="Show assistant"
                          onClick={() => setPanel("agent")}
                        >
                          <Sparkles size={15} />
                        </IconButton>
                        <IconButton
                          label="Show ATS check"
                          onClick={() => setPanel("ats")}
                        >
                          <CheckCheck size={15} />
                        </IconButton>
                        <IconButton
                          label={panel ? "Hide side panel" : "Show side panel"}
                          onClick={() => setPanel(panel ? null : "agent")}
                        >
                          {panel ? (
                            <PanelRightClose size={15} />
                          ) : (
                            <PanelRightOpen size={15} />
                          )}
                        </IconButton>
                      </div>
                    </div>
                    {artifact ? (
                      <PdfPreview
                        artifact={artifact.id}
                        onTextClick={jumpText}
                      />
                    ) : (
                      <div className="pdf-empty">
                        {busy ? (
                          <LoaderCircle className="spin" size={28} />
                        ) : (
                          <FileText size={35} />
                        )}
                        <h3>
                          {busy
                            ? "Typesetting your resume"
                            : "Your PDF belongs here"}
                        </h3>
                        <p>
                          {compileResult && !compileResult.ok
                            ? "Fix the source errors, then compile again."
                            : "Compile your LaTeX to see the real PDF."}
                        </p>
                      </div>
                    )}
                  </section>
                </div>
                <aside className={`insight-panel ${panel ?? "closed"}`}>
                  <Tabs
                    value={panel ?? "agent"}
                    onValueChange={(value) =>
                      setPanel(value === "ats" ? "ats" : "agent")
                    }
                  >
                    <div className="insight-header">
                      <TabsList>
                        <TabsTrigger value="agent">
                          <Sparkles size={14} />
                          Assistant
                          {pending.length > 0 && (
                            <span className="count-badge">
                              {pending.length}
                            </span>
                          )}
                        </TabsTrigger>
                        <TabsTrigger value="ats">
                          <CheckCheck size={14} />
                          ATS check
                        </TabsTrigger>
                      </TabsList>
                      <IconButton
                        label="Close side panel"
                        onClick={() => setPanel(null)}
                      >
                        <PanelRightClose size={15} />
                      </IconButton>
                    </div>
                    <TabsContent
                      value="agent"
                      forceMount
                      className={`insight-content agent-content ${mobileView === "ats" ? "mobile-hide" : ""}`}
                    >
                      <div className="assistant-intro">
                        <span className="assistant-symbol">
                          <Sparkles size={21} />
                        </span>
                        <h2>Assistant</h2>
                        <p>
                          {agentPolicy.mode === "autonomous"
                            ? "Agent edits apply automatically."
                            : "Ask for a change, then review the diff."}
                        </p>
                      </div>
                      <div className="agent-policy-setting">
                        <label htmlFor="agent-edit-mode">Agent edits</label>
                        <select
                          id="agent-edit-mode"
                          value={agentPolicy.mode}
                          disabled={policySaving || applying}
                          onChange={(event) =>
                            void changeAgentPolicy(
                              agentEditModeSchema.parse(event.target.value),
                            )
                          }
                        >
                          <option value="review">Review each edit</option>
                          <option value="autonomous">
                            Apply automatically
                          </option>
                        </select>
                        <small>
                          For this resume, including connected MCP agents.
                        </small>
                        {policySaving && (
                          <span role="status">Saving permission…</span>
                        )}
                      </div>
                      <div className="suggestion-grid">
                        <button
                          disabled={applying || agentBusy || !!draftConflict}
                          onClick={() => {
                            setInstruction(
                              "Tighten one bullet while preserving facts",
                            );
                            void askAgent(
                              undefined,
                              "Tighten one bullet while preserving facts",
                            );
                          }}
                        >
                          Tighten a bullet
                          <ChevronRight size={13} />
                        </button>
                        <button
                          disabled={applying || agentBusy || !!draftConflict}
                          onClick={() => {
                            const sections = [
                              ...source.matchAll(/\\section\*?\{([^}]+)\}/g),
                            ].map((match) => match[1]);
                            const skills = sections.find((section) =>
                              /skills/i.test(section),
                            );
                            if (skills)
                              void askAgent({
                                tool: "reorder_sections",
                                order: [
                                  skills,
                                  ...sections.filter(
                                    (section) => section !== skills,
                                  ),
                                ],
                              });
                          }}
                        >
                          Put skills first
                          <ChevronRight size={13} />
                        </button>
                        <button
                          disabled={
                            applying ||
                            agentBusy ||
                            !!draftConflict ||
                            !job.trim()
                          }
                          onClick={() =>
                            void askAgent({
                              tool: "tailor_to_job",
                              jobDescription: job,
                            })
                          }
                        >
                          Tailor to the job
                          <ChevronRight size={13} />
                        </button>
                      </div>
                      {agentMessage && (
                        <p className="agent-message" role="status">
                          {agentMessage}
                        </p>
                      )}
                      {pending.length === 0 ? (
                        <div className="no-proposals">
                          <Check size={17} />
                          <p>No pending changes.</p>
                        </div>
                      ) : (
                        pending.map((proposal) => (
                          <article className="proposal-card" key={proposal.id}>
                            <div className="proposal-heading">
                              <span className="proposal-icon">
                                <Pencil size={13} />
                              </span>
                              <strong>{proposal.title}</strong>
                            </div>
                            <p>{proposal.explanation}</p>
                            {proposal.baseDigest !== active.digest || dirty ? (
                              <div className="stale-proposal">
                                Document changed. Reject this proposal and
                                request a fresh one.
                              </div>
                            ) : null}
                            {proposal.edits.map((edit, index) => (
                              <div className="diff-review" key={index}>
                                <div className="diff-line-number">
                                  Lines{" "}
                                  {
                                    source.slice(0, edit.start).split("\n")
                                      .length
                                  }
                                  –
                                  {source.slice(0, edit.end).split("\n").length}
                                </div>
                                {edit.expected && (
                                  <pre className="removed">
                                    <span>−</span>
                                    {edit.expected}
                                  </pre>
                                )}
                                <pre className="added">
                                  <span>+</span>
                                  {edit.replacement}
                                </pre>
                              </div>
                            ))}
                            {proposal.evidenceNeeded.length > 0 && (
                              <p className="evidence-needed">
                                Evidence needed:{" "}
                                {proposal.evidenceNeeded.join("; ")}
                              </p>
                            )}
                            <div className="proposal-actions">
                              <Button
                                size="sm"
                                disabled={
                                  applying ||
                                  !!draftConflict ||
                                  proposal.baseDigest !== active.digest ||
                                  dirty ||
                                  proposal.evidenceNeeded.length > 0
                                }
                                onClick={() => void decide(proposal, true)}
                              >
                                <Check size={13} />
                                Accept
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={applying}
                                onClick={() => void decide(proposal, false)}
                              >
                                Reject
                              </Button>
                            </div>
                          </article>
                        ))
                      )}
                      {history[0]?.revision === active.revision &&
                        history[0]?.note.startsWith("Accepted:") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="undo-proposal"
                            disabled={applying || !!draftConflict || dirty}
                            onClick={() => {
                              const index = history.findIndex((item) =>
                                item.note.startsWith("Accepted:"),
                              );
                              const previous = history[index + 1];
                              if (previous) void restore(previous.revision);
                            }}
                          >
                            <Undo2 size={14} />
                            Undo proposal
                          </Button>
                        )}
                      <div className="agent-composer">
                        <label htmlFor="agent-instruction">
                          Ask for a targeted change
                        </label>
                        <Textarea
                          id="agent-instruction"
                          disabled={applying}
                          placeholder="Tighten this bullet, preserve my facts…"
                          value={instruction}
                          onChange={(event) =>
                            setInstruction(event.target.value)
                          }
                          maxLength={4000}
                        />
                        <div>
                          <Button
                            size="sm"
                            disabled={
                              applying ||
                              agentBusy ||
                              !!draftConflict ||
                              !instruction.trim()
                            }
                            onClick={() => void askAgent()}
                          >
                            {agentBusy ? (
                              <LoaderCircle size={14} className="spin" />
                            ) : (
                              <Sparkles size={14} />
                            )}
                            {agentPolicy.mode === "autonomous"
                              ? "Apply"
                              : "Propose"}
                          </Button>
                        </div>
                      </div>
                    </TabsContent>
                    <TabsContent
                      value="ats"
                      forceMount
                      className={`insight-content ats-content ${mobileView === "agent" ? "mobile-hide" : ""}`}
                    >
                      <div className="ats-intro">
                        <h2>ATS check</h2>
                      </div>
                      <label htmlFor="job-description">
                        Job description <span>Optional</span>
                      </label>
                      <Textarea
                        id="job-description"
                        value={job}
                        onChange={(event) => setJob(event.target.value)}
                        placeholder="Paste requirements and responsibilities…"
                        maxLength={20_000}
                        rows={6}
                      />
                      <Button
                        onClick={() => void runAts()}
                        disabled={applying || atsBusy}
                        className="run-ats"
                      >
                        {atsBusy ? (
                          <LoaderCircle size={14} className="spin" />
                        ) : (
                          <CheckCheck size={15} />
                        )}{" "}
                        {atsBusy ? "Reading your PDF…" : "Analyze compiled PDF"}
                      </Button>
                      {ats && (
                        <div className="ats-results">
                          {(ats.digest !== active.digest ||
                            dirty ||
                            ats.engine !== engine ||
                            ats.revision !== active.revision ||
                            ats.jobDescription !== job) && (
                            <p className="stale-proposal">
                              Source changed or the job description was edited.
                              Run analysis again.
                            </p>
                          )}
                          <div className="score-block">
                            <div className="score-number">
                              {ats.score}
                              <small>/100</small>
                            </div>
                            <div>
                              <strong>Resume readiness</strong>
                              <p>
                                {ats.pdf.pages} page · {ats.wordCount} words ·
                                PDF-derived
                              </p>
                            </div>
                          </div>
                          <p className="ats-limits">
                            A transparent heuristic, not a prediction of hiring
                            outcomes or a proprietary ATS score.
                          </p>
                          <div className="score-breakdown">
                            {ats.breakdown.map((item) => (
                              <div key={item.name}>
                                <span>
                                  {item.name}
                                  <small>{item.detail}</small>
                                </span>
                                <strong>
                                  {item.earned}/{item.possible}
                                </strong>
                                <meter
                                  min={0}
                                  max={item.possible}
                                  value={item.earned}
                                />
                              </div>
                            ))}
                          </div>
                          {ats.keywords.length > 0 && (
                            <section className="keyword-section">
                              <h3>Job language</h3>
                              <div className="keyword-tags">
                                {ats.keywords.map((keyword) => (
                                  <span
                                    className={
                                      keyword.matched ? "matched" : "missing"
                                    }
                                    key={keyword.term}
                                    title={`${keyword.method} · BM25 weight ${keyword.weight.toFixed(2)}`}
                                  >
                                    {keyword.matched ? (
                                      <Check size={11} />
                                    ) : (
                                      <Plus size={11} />
                                    )}{" "}
                                    {keyword.term}
                                    {keyword.required && <b>Required</b>}
                                  </span>
                                ))}
                              </div>
                              <p>
                                Exact terms, documented synonyms and simple
                                suffix stems count. Missing words are prompts to
                                check your evidence, never instructions to
                                invent skills.
                              </p>
                            </section>
                          )}
                          <div className="findings">
                            {ats.findings.map((finding) => (
                              <article
                                key={finding.id}
                                className={finding.level}
                              >
                                <div>
                                  {finding.level === "pass" ? (
                                    <Check size={15} />
                                  ) : (
                                    <AlertCircle size={15} />
                                  )}
                                  <h3>{finding.title}</h3>
                                </div>
                                <p>{finding.detail}</p>
                                {finding.level === "warning" && finding.fix && (
                                  <button
                                    disabled={
                                      applying || agentBusy || !!draftConflict
                                    }
                                    onClick={() =>
                                      fixFinding(finding.fix ?? "")
                                    }
                                  >
                                    {finding.fix === "impact"
                                      ? "Add verified evidence"
                                      : "Fix with assistant"}
                                    <ChevronRight size={12} />
                                  </button>
                                )}
                              </article>
                            ))}
                          </div>
                          <details className="ats-extraction">
                            <summary>
                              <FileText size={14} />
                              What ATS sees
                            </summary>
                            <p>
                              Raw PDF reading order. Compare this with the
                              visual preview.
                            </p>
                            <pre data-testid="ats-extracted-text">
                              {ats.pdf.text}
                            </pre>
                          </details>
                          <details className="ats-extraction">
                            <summary>
                              <BookOpen size={14} />
                              Parsed fields
                            </summary>
                            {Object.entries(ats.parsed).map(([key, value]) => (
                              <div className="parsed-field" key={key}>
                                <strong>{key}</strong>
                                <pre>{JSON.stringify(value, null, 2)}</pre>
                              </div>
                            ))}
                          </details>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </aside>
              </div>
              <footer className="workspace-footer">
                <span>
                  Revision {active.revision}
                  <span className="footer-shortcut">⌘ / Ctrl S to compile</span>
                </span>
              </footer>
            </>
          ) : (
            <>
              <header className="dashboard-header">
                <span>
                  My workspace <ChevronRight size={13} />{" "}
                  {dashboardTab === "templates" ? "Templates" : "My resumes"}
                </span>
                <div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setCommandQuery("");
                      setModal("commands");
                    }}
                  >
                    <Search size={15} />
                    Search commands<kbd>⌘ K</kbd>
                  </Button>
                  <span className="mobile-theme">{themeButton}</span>
                  <UserButton />
                </div>
              </header>
              <div className="dashboard-content">
                <div className="dashboard-title">
                  <div>
                    <h1>
                      {dashboardTab === "templates"
                        ? "Templates"
                        : "My resumes"}
                    </h1>
                  </div>
                  <Button onClick={() => setModal("gallery")}>
                    <Plus size={16} />
                    New resume
                  </Button>
                </div>
                {error && (
                  <div className="message error" role="alert">
                    <AlertCircle size={16} />
                    {error}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void refresh()}
                    >
                      Retry
                    </Button>
                  </div>
                )}
                {dashboardTab === "resumes" && (
                  <>
                    {resumes.length > 0 && (
                      <div className="library-heading">
                        <h2>
                          Resumes <span>{resumes.length}</span>
                        </h2>
                        <span>Last edited</span>
                      </div>
                    )}
                    {loading ? (
                      <div className="loading-state">
                        <LoaderCircle className="spin" />
                        Opening your workspace…
                      </div>
                    ) : resumes.length === 0 ? (
                      <div className="empty-library">
                        <div className="empty-paper">
                          <FileText size={34} />
                        </div>
                        <h2>Create your first resume</h2>
                        <p>Choose a layout to start writing.</p>
                        <Button onClick={() => setModal("gallery")}>
                          <Plus size={16} />
                          Create your first resume
                        </Button>
                      </div>
                    ) : (
                      <div className="resume-grid">
                        {resumes.map((resume) => (
                          <button
                            className="resume-card"
                            key={resume.id}
                            onClick={() => void loadDocument(resume.id)}
                          >
                            <MiniPaper template={resume.template} />
                            <div className="resume-card-meta">
                              <FileText size={18} />
                              <div>
                                <h3>{resume.name}</h3>
                                <p>
                                  {new Date(
                                    resume.updatedAt,
                                  ).toLocaleDateString(undefined, {
                                    month: "short",
                                    day: "numeric",
                                  })}{" "}
                                  · Revision {resume.revision}
                                </p>
                              </div>
                              <ChevronRight size={16} />
                            </div>
                          </button>
                        ))}
                        <button
                          className="add-resume-card"
                          onClick={() => setModal("gallery")}
                        >
                          <Plus size={25} />
                          <span>Create another resume</span>
                        </button>
                      </div>
                    )}
                  </>
                )}
                <div className="template-section">
                  <div className="section-heading">
                    <div>
                      <h2>
                        {dashboardTab === "templates"
                          ? "Choose your layout"
                          : "Templates"}
                      </h2>
                    </div>
                    {dashboardTab !== "templates" && (
                      <button onClick={() => setDashboardTab("templates")}>
                        View all templates
                        <ChevronRight size={14} />
                      </button>
                    )}
                  </div>
                  <div className="template-grid">
                    {templates.map((template) => (
                      <button
                        className="template-card"
                        key={template.id}
                        onClick={() => void create(template.id)}
                        disabled={!!creating}
                      >
                        <MiniPaper template={template.id} />
                        <div>
                          <h3>
                            {template.name}
                            {creating === template.id && (
                              <LoaderCircle size={14} className="spin" />
                            )}
                          </h3>
                          <p>{template.description}</p>
                          <div className="template-tags">
                            {template.tags.map((tag) => (
                              <span key={tag}>{tag}</span>
                            ))}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
        <Dialog
          open={modal !== null}
          onOpenChange={(open) => {
            if (!open) setModal(null);
          }}
        >
          <DialogContent
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                setModal(null);
              }
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              const opener = dialogOpener.current;
              dialogOpener.current = null;
              if (findAfterClose.current) {
                findAfterClose.current = false;
                requestAnimationFrame(() => editor.current?.find());
              } else if (opener?.isConnected) opener.focus();
            }}
            className={
              modal === "gallery"
                ? "gallery-dialog"
                : modal === "commands"
                  ? "command-dialog"
                  : ""
            }
          >
            <DialogHeader>
              <DialogTitle>
                {modal === "gallery"
                  ? "Start a new resume"
                  : modal === "history"
                    ? "Version history"
                    : modal === "evidence"
                      ? "Add verified evidence"
                      : modal === "rename"
                        ? "Rename resume"
                        : modal === "delete"
                          ? "Delete this resume?"
                          : "Command menu"}
              </DialogTitle>
              <DialogDescription>
                {modal === "gallery"
                  ? "Choose a starting point. Every layout is editable LaTeX."
                  : modal === "history"
                    ? "Restoring creates a new revision. Your existing history remains intact. The latest 100 versions are shown."
                    : modal === "delete"
                      ? "This deletes the resume, its history, and proposals. Download a copy first if you need it."
                      : modal === "evidence"
                        ? "Use an outcome you can substantiate. Your own evidence will become a targeted proposal for the selected bullet."
                        : modal === "rename"
                          ? "Give this draft a name that helps you find it."
                          : "Find an action. Use Ctrl or Command + K to open this menu."}
              </DialogDescription>
            </DialogHeader>
            {modal === "gallery" && (
              <div className="template-grid">
                {templates.map((template) => (
                  <button
                    className="template-card"
                    key={template.id}
                    onClick={() => void create(template.id)}
                    disabled={!!creating}
                  >
                    <MiniPaper template={template.id} />
                    <div>
                      <h3>{template.name}</h3>
                      <p>{template.description}</p>
                      <Badge variant="secondary">
                        {template.engine === "xelatex" ? "XeLaTeX" : "pdfLaTeX"}
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {modal === "evidence" && (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!evidenceRange) return;
                  const escaped = verifiedEvidence.replace(
                    /[%&#_$]/g,
                    (character) => "\\" + character,
                  );
                  const replacement =
                    evidenceRange.expected.replace(/\.$/, "") + " " + escaped;
                  setModal(null);
                  void askAgent(
                    {
                      tool: "rewrite_bullet",
                      start: evidenceRange.start,
                      end: evidenceRange.end,
                      replacement,
                    },
                    undefined,
                    verifiedEvidence,
                  );
                }}
              >
                <label htmlFor="verified-outcome">Verified outcome</label>
                <Textarea
                  id="verified-outcome"
                  value={verifiedEvidence}
                  onChange={(event) => setVerifiedEvidence(event.target.value)}
                  placeholder="Describe the outcome you can verify…"
                  maxLength={1000}
                />
                <div className="dialog-actions">
                  <Button
                    type="submit"
                    disabled={applying || agentBusy || !verifiedEvidence.trim()}
                  >
                    Review evidence proposal
                  </Button>
                </div>
              </form>
            )}
            {modal === "rename" && (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void mutateName();
                }}
              >
                <Input
                  aria-label="Resume name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={80}
                  autoFocus
                />
                <div className="dialog-actions">
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => setModal("delete")}
                  >
                    <Trash2 size={14} />
                    Delete resume
                  </Button>
                  <Button type="submit" disabled={!name.trim()}>
                    Save name
                  </Button>
                </div>
              </form>
            )}
            {modal === "delete" && (
              <div className="dialog-actions">
                <Button variant="outline" onClick={() => downloadSource()}>
                  Download source
                </Button>
                <Button variant="destructive" onClick={() => void remove()}>
                  Delete resume
                </Button>
              </div>
            )}
            {modal === "history" && (
              <div className="history-list">
                {history.map((item) => (
                  <article key={item.revision}>
                    <div>
                      <strong>
                        Revision {item.revision}
                        {item.revision === active?.revision && (
                          <Badge variant="secondary">Current</Badge>
                        )}
                      </strong>
                      <p>{item.note}</p>
                      <small>{new Date(item.updatedAt).toLocaleString()}</small>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={applying || item.revision === active?.revision}
                      onClick={() => void restore(item.revision)}
                    >
                      Restore
                    </Button>
                  </article>
                ))}
              </div>
            )}
            {modal === "commands" && (
              <>
                <Input
                  value={commandQuery}
                  onChange={(event) => setCommandQuery(event.target.value)}
                  placeholder="Search actions…"
                  aria-label="Search commands"
                  autoFocus
                />
                <div className="command-list">
                  {commands
                    .filter((command) =>
                      command
                        .toLowerCase()
                        .includes(commandQuery.toLowerCase()),
                    )
                    .map((command) => (
                      <button
                        key={command}
                        disabled={
                          (!active && !/theme|new resume/i.test(command)) ||
                          (applying &&
                            (command === "Save and compile" ||
                              command === "Run ATS analysis"))
                        }
                        onClick={() => {
                          setModal(null);
                          runCommand(command);
                        }}
                      >
                        {command}
                        <ChevronRight size={14} />
                      </button>
                    ))}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
function MiniPaper({ template }: { template: string }) {
  return (
    <div className={`mini-paper-preview mini-${template}`} aria-hidden="true">
      <div className="mini-paper">
        <div className="mini-name">
          <i />
        </div>
        <div className="mini-contact">
          <i />
        </div>
        <div className="mini-columns">
          <div className="mini-main">
            {[0, 1, 2].map((section) => (
              <div className="mini-section" key={section}>
                <strong />
                <i />
                <i />
                <i className="short" />
              </div>
            ))}
          </div>
          <div className="mini-side">
            <div className="mini-section">
              <strong />
              <i />
              <i />
              <i className="short" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
