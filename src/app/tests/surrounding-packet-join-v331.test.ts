import { expect, test } from "bun:test";
import ts from "typescript";
import type { SurroundingOwnershipOptions } from "../src/SurroundingCityGeometry";

type Sources = SurroundingOwnershipOptions["sourceQuarterSourcesV303"];
type Join = (
  packet: Promise<unknown>,
  recipes: Promise<Sources>,
  signal: AbortSignal,
) => Promise<[unknown, Sources]>;

const path = new URL("../src/SurroundingCity.ts", import.meta.url);
const source = ts.createSourceFile(
  path.pathname, await Bun.file(path).text(), ts.ScriptTarget.Latest, true,
);
const declaration = source.statements.find(statement =>
  ts.isFunctionDeclaration(statement) && statement.name?.text === "awaitPacketAndRecipesV309"
);
if (!declaration) throw Error("Missing actual streamed packet join");
const { outputText } = ts.transpileModule(declaration.getText(source), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
});
const join = new Function(outputText + "\nreturn awaitPacketAndRecipesV309")() as Join;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test("aborted streamed join releases a parsed packet while its import is pending", async () => {
  const recipes = deferred<Sources>();
  async function cancelWithFullPacket() {
    const task = new AbortController();
    const packet = { bytes: new Uint8Array(8 * 1024 * 1024) };
    const reference = new WeakRef(packet);
    const result = join(Promise.resolve(packet), recipes.promise, task.signal);
    await Bun.sleep(1);
    task.abort();
    await expect(result).rejects.toHaveProperty("name", "AbortError");
    return reference;
  }
  const reference = await cancelWithFullPacket();
  try {
    for (let i = 0; i < 6; i++) {
      await Bun.sleep(1);
      Bun.gc(true);
    }
    expect(reference.deref()).toBeUndefined();
  } finally {
    recipes.resolve(undefined);
  }
});

test("completed join returns both exact values in stable order", async () => {
  for (const packetFirst of [true, false]) {
    const packet = deferred<unknown>();
    const sources = deferred<Sources>();
    const task = new AbortController();
    const result = join(packet.promise, sources.promise, task.signal);
    const body = { id: "actual-geometry" }, records: NonNullable<Sources> = [];
    if (packetFirst) {
      packet.resolve(body);
      await Promise.resolve();
      sources.resolve(records);
    } else {
      sources.resolve(records);
      await Promise.resolve();
      packet.resolve(body);
    }
    const delivered = await result;
    expect(delivered[0]).toBe(body);
    expect(delivered[1]).toBe(records);
    task.abort();
  }
  const data = {};
  expect(await join(Promise.resolve(data), Promise.resolve(undefined), new AbortController().signal))
    .toEqual([data, undefined]);
});

test("errors and pre-aborts settle promptly while both input rejections remain observed", async () => {
  for (const first of ["packet", "recipes", "aborted"] as const) {
    const packet = deferred<unknown>(), recipes = deferred<Sources>();
    const task = new AbortController();
    if (first === "aborted") task.abort();
    const result = join(packet.promise, recipes.promise, task.signal);
    const failure = new Error(first);
    if (first === "packet") packet.reject(failure);
    if (first === "recipes") recipes.reject(failure);
    if (first === "aborted") await expect(result).rejects.toHaveProperty("name", "AbortError");
    else await expect(result).rejects.toBe(failure);
    if (first !== "packet") packet.reject(new Error("late packet"));
    if (first !== "recipes") recipes.reject(new Error("late recipes"));
  }
  await Bun.sleep(1);
});
