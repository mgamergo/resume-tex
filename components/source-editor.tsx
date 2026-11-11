"use client";
import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import {
  EditorState,
  Annotation,
  Compartment,
  StateEffect,
  StateField,
  type Extension,
} from "@codemirror/state";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
  Decoration,
  type DecorationSet,
} from "@codemirror/view";
import {
  history,
  historyKeymap,
  defaultKeymap,
  undo,
  redo,
  indentWithTab,
} from "@codemirror/commands";
import {
  bracketMatching,
  StreamLanguage,
  syntaxHighlighting,
  HighlightStyle,
} from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { stex } from "@codemirror/legacy-modes/mode/stex";
import {
  autocompletion,
  completionKeymap,
  type CompletionContext,
} from "@codemirror/autocomplete";
import {
  searchKeymap,
  highlightSelectionMatches,
  openSearchPanel,
} from "@codemirror/search";
import { setDiagnostics, lintGutter } from "@codemirror/lint";
import type { Diagnostic } from "@/lib/server/compiler";
import type { Edit } from "@/lib/core/model";
export type EditorHandle = {
  jump: (line: number) => void;
  setReadOnly: (value: boolean) => void;
  undo: () => void;
  redo: () => void;
  find: () => void;
  getSelection: () => { start: number; end: number; text: string } | undefined;
};
const sourceHighlightStyle = HighlightStyle.define([
  { tag: tags.comment, color: "var(--syntax-comment)" },
  {
    tag: [
      tags.keyword,
      tags.tagName,
      tags.atom,
      tags.standard(tags.name),
      tags.definition(tags.variableName),
    ],
    color: "var(--syntax-command)",
  },
  { tag: tags.number, color: "var(--syntax-number)" },
  {
    tag: [tags.bracket, tags.punctuation, tags.operator],
    color: "var(--syntax-punctuation)",
  },
  { tag: tags.string, color: "var(--syntax-string)" },
]);
const externalChange = Annotation.define<boolean>();
const setProposals = StateEffect.define<Edit[]>();
const proposalField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, transaction) {
    value = value.map(transaction.changes);
    for (const effect of transaction.effects)
      if (effect.is(setProposals))
        value = Decoration.set(
          effect.value
            .filter(
              (edit) =>
                edit.end > edit.start &&
                edit.end <= transaction.state.doc.length,
            )
            .map((edit) =>
              Decoration.mark({ class: "proposal-range" }).range(
                edit.start,
                edit.end,
              ),
            )
            .sort((a, b) => a.from - b.from),
          true,
        );
    return value;
  },
  provide: (field) => EditorView.decorations.from(field),
});
const theme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "12px",
    backgroundColor: "var(--editor)",
    color: "var(--foreground)",
  },
  ".cm-scroller": {
    fontFamily: "'DejaVu Sans Mono', 'SFMono-Regular', Consolas, monospace",
    overflow: "auto",
    lineHeight: "1.8",
  },
  ".cm-content": { padding: "16px 0", caretColor: "var(--foreground)" },
  ".cm-gutters": {
    backgroundColor: "var(--editor)",
    color: "var(--muted-foreground)",
    borderRight: "1px solid var(--border)",
    paddingRight: "8px",
  },
  ".cm-activeLine,.cm-activeLineGutter": {
    backgroundColor: "var(--active-line)",
  },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
    backgroundColor: "#315fea30",
  },
  ".cm-cursor": { borderLeftColor: "var(--foreground)" },
  ".cm-tooltip": {
    backgroundColor: "var(--background)",
    color: "var(--foreground)",
    border: "1px solid var(--border)",
  },
  ".cm-panels": {
    backgroundColor: "var(--background)",
    color: "var(--foreground)",
  },
  ".cm-search input": { border: "1px solid var(--border)" },
  ".cm-foldPlaceholder": { background: "transparent" },
});
const darkCompartment = new Compartment();
const readOnlyCompartment = new Compartment();
function latexComplete(context: CompletionContext) {
  const word = context.matchBefore(/\\[a-zA-Z]*/);
  if (!word) return null;
  return {
    from: word.from,
    options: [
      "section",
      "subsection",
      "textbf",
      "textit",
      "begin",
      "end",
      "item",
      "resumeItem",
      "cventry",
      "cvitem",
      "href",
      "vspace",
      "hfill",
      "newcommand",
      "usepackage",
    ].map((label) => ({ label: "\\" + label, type: "keyword" })),
  };
}
export const SourceEditor = forwardRef<
  EditorHandle,
  {
    value: string;
    onChange: (source: string) => void;
    onSave: () => void;
    dark: boolean;
    diagnostics: Diagnostic[];
    edits: Edit[];
  }
>(({ value, onChange, onSave, dark, diagnostics, edits }, ref) => {
  const initial = useRef({ value, dark });
  const target = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const callbacks = useRef({ onChange, onSave });
  useEffect(() => {
    callbacks.current = { onChange, onSave };
  }, [onChange, onSave]);
  useImperativeHandle(
    ref,
    () => ({
      setReadOnly(value) {
        view.current?.dispatch({
          effects: readOnlyCompartment.reconfigure([
            EditorState.readOnly.of(value),
            EditorView.editable.of(!value),
          ]),
        });
      },
      jump(line) {
        const editor = view.current;
        if (!editor) return;
        const targetLine = editor.state.doc.line(
          Math.max(1, Math.min(line, editor.state.doc.lines)),
        );
        editor.dispatch({
          selection: { anchor: targetLine.from },
          effects: EditorView.scrollIntoView(targetLine.from, { y: "center" }),
        });
        editor.focus();
      },
      undo() {
        if (view.current) undo(view.current);
      },
      redo() {
        if (view.current) redo(view.current);
      },
      find() {
        if (view.current) openSearchPanel(view.current);
      },
      getSelection() {
        const editor = view.current;
        if (!editor) return;
        const selection = editor.state.selection.main;
        return {
          start: selection.from,
          end: selection.to,
          text: editor.state.sliceDoc(selection.from, selection.to),
        };
      },
    }),
    [],
  );
  useEffect(() => {
    if (!target.current) return;
    const extensions: Extension[] = [
      readOnlyCompartment.of([
        EditorState.readOnly.of(false),
        EditorView.editable.of(true),
      ]),
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightActiveLine(),
      drawSelection(),
      history(),
      bracketMatching(),
      StreamLanguage.define(stex),
      syntaxHighlighting(sourceHighlightStyle),
      autocompletion({ override: [latexComplete] }),
      highlightSelectionMatches(),
      lintGutter(),
      proposalField,
      theme,
      darkCompartment.of(EditorView.theme({}, { dark: initial.current.dark })),
      keymap.of([
        {
          key: "Mod-s",
          run: () => {
            callbacks.current.onSave();
            return true;
          },
        },
        ...defaultKeymap,
        ...historyKeymap,
        ...searchKeymap,
        ...completionKeymap,
        indentWithTab,
      ]),
      EditorView.contentAttributes.of({
        "aria-label": "LaTeX source",
        spellcheck: "false",
      }),
      EditorView.updateListener.of((update) => {
        if (
          update.docChanged &&
          !update.transactions.some((transaction) =>
            transaction.annotation(externalChange),
          )
        )
          callbacks.current.onChange(update.state.doc.toString());
      }),
    ];
    const editor = new EditorView({
      state: EditorState.create({ doc: initial.current.value, extensions }),
      parent: target.current,
    });
    view.current = editor;
    return () => {
      editor.destroy();
      view.current = null;
    };
  }, []);
  useEffect(() => {
    const editor = view.current;
    if (editor && editor.state.doc.toString() !== value)
      editor.dispatch({
        changes: { from: 0, to: editor.state.doc.length, insert: value },
        annotations: externalChange.of(true),
      });
  }, [value]);
  useEffect(() => {
    view.current?.dispatch({
      effects: darkCompartment.reconfigure(EditorView.theme({}, { dark })),
    });
  }, [dark]);
  useEffect(() => {
    const editor = view.current;
    if (!editor) return;
    editor.dispatch(
      setDiagnostics(
        editor.state,
        diagnostics.map((diagnostic) => {
          const line = editor.state.doc.line(
            Math.max(1, Math.min(diagnostic.line, editor.state.doc.lines)),
          );
          return {
            from: line.from,
            to: line.to,
            severity: diagnostic.severity,
            message: diagnostic.message,
          };
        }),
      ),
    );
  }, [diagnostics]);
  useEffect(() => {
    view.current?.dispatch({ effects: setProposals.of(edits) });
  }, [edits]);
  return <div className="source-editor" ref={target} />;
});
SourceEditor.displayName = "SourceEditor";
