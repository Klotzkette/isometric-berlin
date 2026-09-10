import { describe, expect, test } from "bun:test";
import { progressiveAttachmentHost } from "./helpers/progressiveAttachmentHost";

const source = await Bun.file(new URL("../src/ThreeViewer.tsx", import.meta.url)).text();

describe("production progressive attachment scheduling", () => {
  test("queued batches keep their original deadline while input stays busy", () => {
    const host = progressiveAttachmentHost(source);
    for (let i = 0; i < 18; i++) host.add(`exact-${i}`);
    const elapsed = host.drain();
    expect(host.attached).toHaveLength(18);
    expect(host.attached[0].at).toBe(900);
    expect(elapsed).toBeLessThan(1_200);
    expect(host.attached.every((entry, i) => entry.id === `exact-${i}`)).toBeTrue();
    // Every upload gets a separate browser task instead of one blocking burst.
    expect(host.attached.slice(1).every((entry, i) => entry.at > host.attached[i].at)).toBeTrue();
  });

  test("available idle time can attach geometry while a joystick is held", () => {
    const host = progressiveAttachmentHost(source, { idleBudgetMs: 8, inputPending: false });
    for (let i = 0; i < 4; i++) host.add(`exact-${i}`);
    expect(host.drain()).toBeLessThanOrEqual(64);
    expect(host.attached).toHaveLength(4);
  });

  test("an early callback with insufficient budget does not restart the deadline", () => {
    const host = progressiveAttachmentHost(source, { idleBudgetMs: 2, initialAgeMs: 850 });
    host.add("exact");
    expect(host.drain()).toBeLessThanOrEqual(66);
    expect(host.attached).toHaveLength(1);
  });

  test("critical previews are immediate; timer fallback still makes progress", () => {
    const preview = progressiveAttachmentHost(source);
    preview.add("buildings-preview-1");
    expect(preview.drain()).toBe(0);
    const fallback = progressiveAttachmentHost(source, { idleApi: false });
    for (let i = 0; i < 4; i++) fallback.add(`exact-${i}`);
    expect(fallback.drain()).toBeLessThan(1_000);
    expect(fallback.attached).toHaveLength(4);
  });

  test("exact building shapes attach in the next task even with continuous pending input", () => {
    for (const idleApi of [true, false]) {
      const host = progressiveAttachmentHost(source, { idleApi, idleBudgetMs: 0, inputPending: true });
      host.add("buildings-exact-1", "buildings");
      host.add("buildings-exact-2", "buildings");
      expect(host.runNext()).toBeTrue();
      expect(host.attached).toEqual([{ id: "buildings-exact-1", at: 0 }]);
      expect(host.drain()).toBe(0);
      expect(host.attached).toHaveLength(2);
      host.complete();
      expect(host.drain()).toBe(0);
      expect(host.attached.at(-1)?.id).toBe("complete");
    }
  });

  test("cancelled, hidden, disposed or replaced worlds cannot attach stale batches", () => {
    for (const stop of ["cancel", "hide", "dispose", "replace"]) {
      const host = progressiveAttachmentHost(source);
      host.add("exact");
      if (stop === "cancel") host.runtime.progressiveWorldAttachCancel?.();
      if (stop === "hide") host.document.hidden = true;
      if (stop === "dispose") host.runtime.disposed = true;
      if (stop === "replace") host.runtime.progressiveWorldWorker = {};
      host.drain();
      expect(host.attached).toHaveLength(0);
    }
  });
});
