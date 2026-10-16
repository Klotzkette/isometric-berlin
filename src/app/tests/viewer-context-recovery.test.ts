import { expect, test } from "bun:test";
import { createViewerContextRecovery } from "../src/viewerContextRecovery";

function harness() {
  const calls: string[] = [];
  const pending = new Set<() => void>();
  const recovery = createViewerContextRecovery({
    pause: () => calls.push("pause"), resume: () => calls.push("resume"), fail: () => calls.push("fail"),
    schedule: callback => { pending.add(callback); return () => { pending.delete(callback); }; },
  });
  const lose = () => { const event = new Event("webglcontextlost", { cancelable: true }); recovery.lost(event); return event; };
  return { recovery, calls, pending, lose };
}

test("repeated temporary GPU resets preserve the runtime and cancel the fallback", () => {
  const h = harness();
  for (let i = 0; i < 3; i++) {
    expect(h.lose().defaultPrevented).toBe(true);
    h.lose(); // Repeated events do not duplicate timers or pause work twice.
    expect(h.pending.size).toBe(1);
    const staleTimeout = [...h.pending][0];
    h.recovery.restored();
    staleTimeout();
    h.recovery.restored();
    expect(h.pending.size).toBe(0);
  }
  expect(h.calls).toEqual(["pause", "resume", "pause", "resume", "pause", "resume"]);
});

test("an unavailable GPU falls back exactly once, without resuming an expired runtime", () => {
  const h = harness(); h.lose();
  const timeout = [...h.pending][0]; timeout(); timeout();
  h.lose(); h.recovery.restored();
  expect(h.calls).toEqual(["pause", "fail"]);
});

test("unmount cancels pending recovery and ignores late browser events", () => {
  const h = harness(); h.lose(); const timeout = [...h.pending][0];
  h.recovery.dispose(); timeout(); h.recovery.restored(); h.lose();
  expect(h.pending.size).toBe(0);
  expect(h.calls).toEqual(["pause"]);
});


test("a cancelled older timeout cannot expire a later GPU reset", () => {
  const h = harness(); h.lose(); const oldTimeout = [...h.pending][0];
  h.recovery.restored(); h.lose(); oldTimeout();
  expect(h.calls).toEqual(["pause", "resume", "pause"]);
  h.recovery.restored();
  expect(h.calls.at(-1)).toBe("resume");
});

test("restoring a desktop startup retries deferred details even when visibility only resumes mobile work", async () => {
  const source = await Bun.file(new URL("../src/ThreeViewer.tsx", import.meta.url)).text();
  const start = source.indexOf("        resume: () => {", source.indexOf("const contextRecovery ="));
  const body = source.slice(start + "        resume: () => {".length, source.indexOf("\n        },\n        fail:", start));
  const calls: string[] = [];
  const runtime = { worldFailureReported: false, contextLost: true, renderInvalidated: false,
    shadowInvalidated: false, startDeferredDetails: () => calls.push("details"),
    surroundingCity: { refresh: () => calls.push("city") } };
  const renderer = { shadowMap: { needsUpdate: false } };
  // Execute the shipped restoration callback, with an already-visible desktop
  // tab. Visibility resumption itself deliberately does not start park details.
  new Function("runtime", "renderer", "resize", "onVisibilityChange", "notifyPresentationReadyWhenPossible",
    `let disposed=false,lastAnimateAt=1,lastRenderedAt=1,lastEvaluationAt=1,lastOrdinaryEnvironmentFrameAt=1;${body}`
  )(runtime, renderer, () => calls.push("resize"), () => calls.push("visible"), () => calls.push("ready"));
  expect(runtime.contextLost).toBe(false);
  expect(runtime.renderInvalidated).toBe(true);
  expect(renderer.shadowMap.needsUpdate).toBe(true);
  expect(calls).toEqual(["resize", "visible", "details", "city", "ready"]);
});
