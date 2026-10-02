import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import config, { altMitteV169ManualChunk } from "../vite.config";

test("each bounded Alt-Mitte source packet keeps a separate mode-specific output chunk", () => {
  const draw = "/project/src/app/src/data/altMitteV169Drawn/packet-007.json";
  const native = "/project/src/app/src/data/altMitteV169Native/packet-007.json";
  expect(altMitteV169ManualChunk(draw)).toBe("alt-mitte-v169-drawn-packet-007");
  expect(altMitteV169ManualChunk(native)).toBe(
    "alt-mitte-v169-native-packet-007",
  );
  expect(
    altMitteV169ManualChunk(
      "/project/src/app/src/data/altMitteV169Navigation/packet-002.json",
    ),
  ).toBe("alt-mitte-v169-navigation-packet-002");
  expect(altMitteV169ManualChunk(`${draw}?import`)).toBe(
    altMitteV169ManualChunk(draw),
  );
  expect(altMitteV169ManualChunk(native.replaceAll("/", "\\"))).toBe(
    altMitteV169ManualChunk(native),
  );
  expect(altMitteV169ManualChunk(draw.replace("007", "1001"))).toBe(
    "alt-mitte-v169-drawn-packet-1001",
  );
  expect(
    altMitteV169ManualChunk("/project/src/data/altMitteDrawnV169Data.ts"),
  ).toBeUndefined();
  expect(
    altMitteV169ManualChunk("/project/src/data/unrelated/packet-007.json"),
  ).toBeUndefined();
  const all = new Set<string | undefined>();
  for (const mode of ["Drawn", "Native", "Navigation"])
    for (let index = 0; index < 1000; index++)
      all.add(
        altMitteV169ManualChunk(
          `/src/data/altMitteV169${mode}/packet-${String(index).padStart(3, "0")}.json`,
        ),
      );
  expect(all.size).toBe(3000);
  expect(all.has(undefined)).toBe(false);
});

test("the production output uses packet partitioning and retains the existing vendor chunks", () => {
  const output = config.build!.rollupOptions!.output as {
    manualChunks: (id: string) => string | undefined;
  };
  expect(
    output.manualChunks("/src/data/altMitteV169Native/packet-001.json"),
  ).toBe("alt-mitte-v169-native-packet-001");
  expect(output.manualChunks("/project/node_modules/three/src/Three.js")).toBe(
    "three-engine",
  );
  expect(output.manualChunks("/project/node_modules/react/index.js")).toBe(
    "react-vendor",
  );
  expect(output.manualChunks("/project/src/App.tsx")).toBeUndefined();
});

test("an unused navigation import cannot retain its source data in the progressive worker", async () => {
  const entry = "virtual:alt-mitte-v169-unused-navigation";
  const profile = fileURLToPath(
    new URL("../src/altMitteV169Profile.ts", import.meta.url),
  );
  const result = await build({
    configFile: false,
    logLevel: "error",
    plugins: [{
      name: "unused-navigation-regression",
      resolveId(id) { if (id === entry) return entry; },
      load(id) {
        if (id === entry)
          return `import ${JSON.stringify(profile)}; export const workerOnly=true;`;
      },
    }],
    build: {
      write: false,
      minify: true,
      rollupOptions: {
        input: entry,
        preserveEntrySignatures: "strict",
        output: { format: "es" },
      },
    },
  });
  if (Array.isArray(result) || !("output" in result))
    throw new Error("Expected one in-memory production bundle");
  const chunks = result.output.filter((item) => item.type === "chunk");
  expect(chunks).toHaveLength(1);
  const code = chunks[0].code;
  // The small ownership Set may remain; 13 MB of roof/part JSON must not.
  expect(new TextEncoder().encode(code).byteLength).toBeLessThan(100_000);
  expect(code).toContain("workerOnly");
  expect(code).not.toContain("nativeRoofSpans");
  expect(code).not.toContain("roofTriangles");
  expect(code).not.toContain("legacyPrisms");
});
