/** Build-only finite ownership rule for three read-only facade recipe records.
 * Each tile retains its own weak plan, rather than inflating an entire region
 * when the existing serial district decoder reads one key. */
export const NEIGHBOURHOOD_PLAN_SOURCES_V300: ReadonlySet<string> = new Set([
  "data/wilhelmStreetFrontsV325Packets.json",
  "data/wilhelmHousingV324Packets.json",
  "data/clusterFacadesV320.json",
  "data/berlinSenateV321.json",
  "data/federalMinistriesV321Packets.json",
  "data/universitiesV322Packets.json",
  "data/youthTheatreFrontsV322Packets.json",
  "data/moabitMitteV300.json", "data/ostHousingV301.json", "data/westKiezV302.json",
  "data/friedrichshainV303.json", "data/rixdorfV304.json", "data/neukoellnLandmarksV305Packets.json",
  "data/northernFidelityV309Packets.json",
]);
type Transform = { code: string; map: null; moduleType: "js" };

export function transformNeighbourhoodPlansV300(
  data: unknown, sourcePath: string, decoder: string,
  stringify: (value: unknown) => string,
  pack: (json: string) => { encoded: string; admissionLength: number },
): Transform | undefined {
  if (!NEIGHBOURHOOD_PLAN_SOURCES_V300.has(sourcePath)) return undefined;
  const source = data as { schemaVersion?: unknown; keys?: unknown; packets?: unknown };
  if (!source || source.schemaVersion !== 1 || !Array.isArray(source.keys) ||
    source.keys.length > 512 || source.keys.some(k => typeof k !== "string" || !/^(drawn|minecraft):[A-Za-z0-9_.-]+$/.test(k)) ||
    !source.packets || typeof source.packets !== "object" || Array.isArray(source.packets)) throw Error("Invalid finite neighbourhood construction source");
  const keys = source.keys as string[], packets = source.packets as Record<string, unknown>;
  if (new Set(keys).size !== keys.length || keys.length !== Object.keys(packets).length ||
    keys.some(key => !Object.hasOwn(packets, key) || !packets[key] || typeof packets[key] !== "object")) throw Error("Neighbourhood recipe index differs from its exact record");
  // Retain the packet property's original root position while replacing only
  // its heavy value. Both root and per-packet insertion order are observable.
  const rest = { ...source, packets: null } as Record<string, unknown>;
  const lines = [`const __source = JSON.parse(${JSON.stringify(stringify(rest))});`, "const __packets = {};"];
  let compressed = false;
  for (const [index, key] of Object.keys(packets).entries()) {
    const json = stringify(packets[key]), packed = pack(json);
    const useGzip = packed.admissionLength < json.length * .8;
    compressed ||= useGzip;
    const read = `__read${index}`, cache = `__cache${index}`, weak = `__weak${index}`, loaded = `__loaded${index}`;
    lines.push(`let ${cache}, ${weak}, ${loaded} = false;`,
      `function ${read}() {`, `  if (${loaded}) return ${cache};`, `  let value = ${weak}?.deref();`,
      "  if (value === undefined) {",
      `    value = ${useGzip ? `__decodeLosslessGzip(${JSON.stringify(packed.encoded)})` : `JSON.parse(${JSON.stringify(json)})`};`,
      `    if (typeof WeakRef === "function") ${weak} = new WeakRef(value);`,
      `    else { ${cache} = value; ${loaded} = true; }`, "  }", "  return value;", "}",
      `Object.defineProperty(__packets, ${JSON.stringify(key)}, { enumerable: true, configurable: true, get: ${read}, set(value) { ${cache} = value; ${loaded} = true; ${weak} = undefined; } });`);
  }
  lines.push("__source.packets = __packets;");
  const aliases: string[] = [];
  for (const [index, key] of Object.keys({ ...rest, packets }).entries()) {
    if (key === "default" || !/^[$_\p{ID_Start}][$_\u200c\u200d\p{ID_Continue}]*$/u.test(key)) continue;
    lines.push(`const __named${index} = __source[${JSON.stringify(key)}];`); aliases.push(`__named${index} as ${key}`);
  }
  if (aliases.length) lines.push(`export { ${aliases.join(", ")} };`);
  lines.push("export default __source;");
  return { code: (compressed ? `import { decodeLosslessGzipJson as __decodeLosslessGzip } from ${JSON.stringify(decoder)};\n` : "") + lines.join("\n"), map: null, moduleType: "js" };
}
