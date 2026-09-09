import ts from "typescript";
import {
  progressiveAttachmentReady,
  progressiveAttachmentRemainingMs,
  PROGRESSIVE_ATTACHMENT_MAX_DEFERRAL_MS,
} from "../../src/progressiveWorld";

/** Execute the shipped scheduler with a deterministic browser task queue. */
export function progressiveAttachmentHost(source: string, options: {
  idleApi?: boolean; idleBudgetMs?: number; inputPending?: boolean;
  legacyReady?: boolean; initialAgeMs?: number;
} = {}) {
  const parsed = ts.createSourceFile("ThreeViewer.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declaration = parsed.statements.find(node =>
    ts.isFunctionDeclaration(node) && node.name?.text === "scheduleProgressiveAttachment");
  if (!declaration) throw new Error("Missing production attachment scheduler");
  const compiled = ts.transpileModule(declaration.getText(parsed), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  let now = 0;
  let nextId = 0;
  const tasks = new Map<number, { at: number; run: () => void }>();
  const enqueue = (run: () => void, delay: number) => {
    const id = ++nextId;
    tasks.set(id, { at: now + delay, run });
    return id;
  };
  const window = {
    setTimeout: enqueue,
    clearTimeout: (id: number) => tasks.delete(id),
    ...(options.idleApi === false ? {} : {
      requestIdleCallback: (run: (deadline: { timeRemaining: () => number }) => void, { timeout }: { timeout: number }) =>
        enqueue(() => run({ timeRemaining: () => options.idleBudgetMs ?? 0 }),
          (options.idleBudgetMs ?? 0) > 0 ? Math.min(16, timeout) : timeout),
      cancelIdleCallback: (id: number) => tasks.delete(id),
    }),
  };
  const worker = {};
  const document = { hidden: false };
  const runtime = {
    progressiveWorldMessages: [] as Array<{ enqueuedAt: number; message: { id: string; type: string } }>,
    progressiveWorldAttachCancel: undefined as (() => void) | undefined,
    progressiveWorldWorker: worker as object | undefined,
    disposed: false, interactionUntil: Number.POSITIVE_INFINITY,
  };
  const attached: Array<{ id: string; at: number }> = [];
  const bindings = {
    window, document, performance: { now: () => now },
    progressiveVisibilityBatch: (message: { id: string }) => message.id.startsWith("preview"),
    progressiveAttachmentReady: options.legacyReady
      ? (input: Parameters<typeof progressiveAttachmentReady>[0]) => input.critical || input.queuedForMs >= 900 || (!input.interactionActive && !input.inputPending && input.idleBudgetMs >= 4)
      : progressiveAttachmentReady,
    progressiveAttachmentRemainingMs, PROGRESSIVE_ATTACHMENT_MAX_DEFERRAL_MS,
    browserInputPending: () => options.inputPending ?? true,
    attachProgressiveWorldMessage: (_runtime: unknown, _worker: unknown, message: { id: string }) => {
      attached.push({ id: message.id, at: now });
    },
  };
  const schedule = new Function(...Object.keys(bindings), `${compiled}; return scheduleProgressiveAttachment;`)(
    ...Object.values(bindings),
  ) as (runtime: unknown, worker: unknown, warn: () => void) => void;
  return {
    runtime, document, attached,
    add(id: string) {
      runtime.progressiveWorldMessages.push({ enqueuedAt: now - (options.initialAgeMs ?? 0), message: { id, type: "batch" } });
      schedule(runtime, worker, () => {});
    },
    runNext() {
      const next = [...tasks].sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!next) return false;
      tasks.delete(next[0]); now = next[1].at; next[1].run();
      return true;
    },
    drain() {
      for (let count = 0; this.runNext(); count += 1) {
        if (count > 10_000) throw new Error("Attachment scheduler did not make progress");
      }
      return now;
    },
  };
}
