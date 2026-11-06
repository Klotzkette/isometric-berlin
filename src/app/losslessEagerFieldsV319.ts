/** One published198 ordinary eager field. Encode only its exact immutable
 * literal; retain eager strong ownership, descriptors and named-export alias. */
import { createHash } from "node:crypto";

export const LOSSLESS_EAGER_FIELDS_V319: Readonly<Record<string, readonly string[]>> = Object.freeze({
  "data/zooHousesV282.json": Object.freeze(["penguin"]),
});
export const LOSSLESS_EAGER_SOURCE_SHA_V319 = "589bf1ca5a0e4dc9b4d39bcff81ba49bc46a47896ce32a1829cf7f3a797f9031";
export const LOSSLESS_EAGER_FIELD_SHA_V319 = "43f0f49963f706e60680eb62631857578523036c63a6f2577dd6190526e9e2e0";
const sha = (source: string) => createHash("sha256").update(source).digest("hex");

export function exactEagerFieldsV319(path: string, source: string): readonly string[] {
  const fields = LOSSLESS_EAGER_FIELDS_V319[path];
  if (!fields) return [];
  if (sha(source) !== LOSSLESS_EAGER_SOURCE_SHA_V319) throw Error("Changed exact v319 eager source");
  return fields;
}

/** Called on the existing exactJson result, preserving its original -0 policy,
 * gzip admission decision, prepared stream selection and OS marker. */
export function assertEagerFieldV319(path: string, field: string, json: string): void {
  if (path !== "data/zooHousesV282.json" || field !== "penguin" || sha(json) !== LOSSLESS_EAGER_FIELD_SHA_V319)
    throw Error("Changed exact v319 eager field");
}
