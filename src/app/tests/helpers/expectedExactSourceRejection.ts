import { readdirSync, readFileSync } from "node:fs";

// The calling test verifies the receipt chain before checking damaged buffers.
// Look up the first decoder that should see this path, starting at today's end.
const fixtures = new URL("../fixtures/", import.meta.url);
const latestChange = new Map<string, number>();
for (const file of readdirSync(fixtures).sort()) {
  const version = /^source-history-v(\d{3})\.json$/.exec(file);
  if (!version || Number(version[1]) < 341) continue;
  const receipt = JSON.parse(readFileSync(new URL(file, fixtures), "utf8"));
  for (const path of Object.keys(receipt.changes)) latestChange.set(path, Number(version[1]));
}

export function expectedExactSourceRejection(path: string): Error {
  const version = latestChange.get(path);
  if (version === undefined) throw new Error("Missing exact change receipt for " + path);
  return new Error(`Unknown exact v${version} source bytes: ${path}`);
}
