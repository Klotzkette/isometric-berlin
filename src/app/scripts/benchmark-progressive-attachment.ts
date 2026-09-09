/** Deterministic scheduling comparison, not a GPU/browser-FPS benchmark. */
import { progressiveAttachmentHost } from "../tests/helpers/progressiveAttachmentHost";

const current = await Bun.file(new URL("../src/ThreeViewer.tsx", import.meta.url)).text();
const referencePath = process.env.PROGRESSIVE_ATTACHMENT_REFERENCE;
const versions = [{ name: "current", source: current, legacyReady: false }];
if (referencePath) versions.unshift({ name: "reference", source: await Bun.file(referencePath).text(), legacyReady: true });

const rows = [];
for (const version of versions) {
  for (const idleBudgetMs of [0, 8]) {
    // Match the production worker's four-buffer backpressure, replenishing
    // only after the main thread acknowledges an attachment.
    const host = progressiveAttachmentHost(version.source, {
      idleBudgetMs, inputPending: idleBudgetMs === 0, legacyReady: version.legacyReady,
    });
    let posted = 0;
    for (; posted < 4; posted++) host.add(`exact-${posted}`);
    let received = 0;
    while (host.runNext()) {
      while (received < host.attached.length) {
        received++;
        if (posted < 18) host.add(`exact-${posted++}`);
      }
    }
    rows.push({ version: version.name, idle_budget_ms: idleBudgetMs,
      total_attached: received, last_attachment_ms: host.attached.at(-1)?.at,
      attachment_times_ms: host.attached.map(entry => entry.at) });
  }
}
console.log(JSON.stringify({ note: "Deterministic browser task simulation, 18 batches, four in flight, continuously held joystick; excludes network, construction and GPU upload.", rows }, null, 2));
