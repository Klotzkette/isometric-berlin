import type { Plugin } from "vite";

export const LOSSLESS_JSON_FIELD_BYTES = 64 * 1024;

const PACKED_PACKET_JSON = /\/data\/altMitteV169(?:Drawn|Native)\/packet-\d+\.json$/;
const DATA_JSON = /\/src\/app\/src\/data\/.+\.json$/;
const EXPORT_NAME = /^[$_\p{ID_Start}][$_\u200c\u200d\p{ID_Continue}]*$/u;

/** JSON.stringify normally changes -0 and non-finite parsed JSON numbers. */
function exactJson(value: unknown): string {
  const ordinary = JSON.stringify(value);
  let token = "\u0000isometric-json-number\u0000";
  while (ordinary.includes(JSON.stringify(token).slice(1, -1))) token += "_";
  const replacements: Array<[string, string]> = [];
  const encoded = JSON.stringify(value, (_key, item: unknown) => {
    if (typeof item !== "number" || (Number.isFinite(item) && !Object.is(item, -0))) {
      return item;
    }
    const marker = `${token}${replacements.length}`;
    replacements.push([
      JSON.stringify(marker),
      Object.is(item, -0) ? "-0" : item > 0 ? "1e400" : "-1e400",
    ]);
    return marker;
  });
  return replacements.reduce(
    (text, [marker, number]) => text.replaceAll(marker, number),
    encoded,
  );
}

/** Object-literal __proto__ is special syntax; JSON.parse keeps an own key. */
function hasProtoKey(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Object.hasOwn(value, "__proto__")) return true;
  return Object.values(value).some(hasProtoKey);
}

export type LosslessJsonTransform = {
  code: string;
  map: null;
  moduleType: "js";
};

/**
 * Preserve the complete source values, but decode large top-level arrays only
 * when a consumer reads that field. Day does not need to instantiate the
 * separate native-block rows; a Worker reading metadata does not need to
 * instantiate the main thread's render arrays. Strong caches retain identity
 * and mutations after the first read. No coordinate is quantized or omitted.
 *
 * Named exports use pure initializers so the bundler can remove unused ones;
 * an actually imported named array and its default-object field share one
 * cached value. This plugin is scoped to the application's source payloads:
 * their consumers read fields and mutate returned arrays, but do not inspect
 * property descriptors or replace sealed/frozen fields. Lazy fields expose
 * accessors, so descriptor-sensitive objects are outside this contract.
 */
export function transformLosslessJsonData(
  source: string,
  id: string,
  thresholdBytes = LOSSLESS_JSON_FIELD_BYTES,
): LosslessJsonTransform | undefined {
  if (!DATA_JSON.test(id.replaceAll("\\", "/")) || source.length < thresholdBytes) {
    return undefined;
  }
  const data: unknown = JSON.parse(source.replace(/^\uFEFF/, ""));
  // These packets contain a handful of objects and already-packed base64
  // strings, not huge numeric arrays. Wrapping them in JSON.parse would retain
  // both the encoded JSON text and another copy of every base64 string after
  // the first read. Direct literals share the original string constants.
  const packedPacket = PACKED_PACKET_JSON.test(id.replaceAll("\\", "/"));
  if (Array.isArray(data)) {
    return {
      code: `export default /* @__PURE__ */ JSON.parse(${JSON.stringify(source.replace(/^\uFEFF/, ""))});`,
      map: null,
      moduleType: "js",
    };
  }
  if (!data || typeof data !== "object") return undefined;
  const declarations: string[] = [];
  const exports: string[] = [];
  const properties: string[] = [];
  let lazyFields = 0;
  for (const [index, [key, value]] of Object.entries(data).entries()) {
    const json = exactJson(value);
    const field = `__field${index}`;
    const property = `[${JSON.stringify(key)}]`;
    if (!packedPacket && Array.isArray(value) && json.length >= thresholdBytes) {
      lazyFields += 1;
      const cache = `__cache${index}`;
      const loaded = `__loaded${index}`;
      const read = `__read${index}`;
      declarations.push(
        `let ${cache}, ${loaded} = false;`,
        `function ${read}() {`,
        `  if (!${loaded}) {`,
        `    ${cache} = JSON.parse(${JSON.stringify(json)});`,
        `    ${loaded} = true;`,
        "  }",
        `  return ${cache};`,
        "}",
        `const ${field} = /* @__PURE__ */ ${read}();`,
      );
      properties.push(
        `get ${property}() { return ${read}(); }`,
        [
          `set ${property}(value) {`,
          '  if (Object.isFrozen(this)) throw new TypeError("Cannot assign a frozen source field");',
          `  ${cache} = value; ${loaded} = true;`,
          "}",
        ].join("\n"),
      );
    } else {
      const literal = hasProtoKey(value)
        ? `/* @__PURE__ */ JSON.parse(${JSON.stringify(json)})`
        : json;
      declarations.push(`const ${field} = ${literal};`);
      properties.push(`${property}: ${field}`);
    }
    // Export aliases may be reserved words, but bindings above never are.
    if (key !== "default" && EXPORT_NAME.test(key)) exports.push(`${field} as ${key}`);
  }
  if (lazyFields === 0 && !packedPacket) return undefined;
  return {
    code: `${declarations.join("\n")}\nexport { ${exports.join(", ")} };\nexport default {\n${properties.join(",\n")}\n};`,
    map: null,
    moduleType: "js",
  };
}

/** Install separately in the application and Worker build plugin lists. */
export function losslessJsonData(): Plugin {
  return {
    name: "isometric-berlin-lossless-json-data",
    enforce: "pre",
    transform(source, id) {
      return transformLosslessJsonData(source, id);
    },
  };
}
