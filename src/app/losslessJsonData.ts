import type { Plugin } from "vite";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

export const LOSSLESS_JSON_FIELD_BYTES = 64 * 1024;

const PACKED_PACKET_JSON = /\/data\/altMitteV169(?:Drawn|Native)\/packet-\d+\.json$/;
const DATA_JSON = /\/src\/app\/src\/data\/.+\.json$/;
// These two legacy source objects are retained by navigation profile modules.
// Keep one eager, strongly owned module object; weak constructor getters would
// not match their lifetime. Only their source encoding changes.
const EAGER_RETAINED_SOURCE_JSON = /\/src\/app\/src\/(?:leipzigerPlatzSource|schlossNaturkundeSource)\.json$/;
const EXPORT_NAME = /^[$_\p{ID_Start}][$_\u200c\u200d\p{ID_Continue}]*$/u;

/** Audited constructor inputs, never mutated or retained by their render roots.
 * Do not extend by filename pattern: navigation and mutable source caches have
 * different ownership contracts. See docs/source-cache-lifetime-v181.md. */
export const READONLY_CONSTRUCTION_JSON_FIELDS: Readonly<Record<string, readonly string[]>> = {
  "columbiahalleV257.json": ["drawn", "minecraft"],
  "leipzigerMuenzeV257.json": ["cells"],
  "tierparkV255.json": ["packets"],
  // The hospital constructor consumes these rows synchronously into its own
  // instance buffers. Navigation retains only the separate small helipad data.
  "bundeswehrHospitalV214.json": ["boxes", "blocks", "padTriangles"],
  // Independent navigation data stays strongly owned; these constructor rows
  // are copied into render buffers and reconstruct exactly after collection.
  "tachelesV167Source.json": ["surfaces", "facadeBoxes", "nativeRows", "nativeDetailRows"],
  "mainStreetEdgesV254.json": ["packets"],
  "westShopfrontsV254.json": ["packets"],
  "northShopfrontsV254.json": ["drawn", "native"],
  // Read-only appearance receipts are used only during yielded packet decode;
  // roots retain final colours, never the receipt map. Compress without loss.
  "altMitteAppearanceV213.json": ["packets"],
  "gipsKoppenV252.json": ["boxes", "rods", "nativeRows"],
  "kulturbrauereiV252.json": ["drawn", "native"],
  "lennonV250.json": ["boxes", "rods", "nativeRows"],
  "steglitzSchoolV250.json": ["boxes", "rods", "nativeRows"],
  "steglitzCourtyardV251.json": ["boxes", "rods", "nativeRows"],
  "steglitzCourtGroundV251.json": ["boxes", "rods", "nativeRows"],
  "chorinerV250.json": ["faces"],
  // Finite mapped bridge constructor packets; roots retain only decoded
  // geometry and their small navigation, never packed mesh/source objects.
  "spreeBridgesV242.json": ["core"],
  "museumBridgesV243.json": ["core"],
  "ihzV241.json": ["drawn", "minecraft"],
  "ihzV241Previous.json": ["records"],
  "aegCampusV241.json": ["drawn", "minecraft"],
  "quartier207V241.json": ["drawn", "minecraft"],
  "quartier207V241Previous.json": ["records"],
  "staatsbibliothekV241.json": ["drawn", "minecraft"],
  "staatsbibliothekV241Previous.json": ["records", "lineRecords", "boxes", "blocks", "surfaces"],
  "staatsoperV240.json": ["drawn", "minecraft"],
  "staatsoperV240Previous.json": ["records", "boxes", "segments"],
  // Atomic named-site packets are immutable construction inputs. Prepared
  // generators retain one receipt only until decoding; roots keep no payload.
  "requiredMitteV239.json": ["drawn", "minecraft"],
  "schlossplatzV239AltMittePrevious.json": ["records"],
  "northElevatedV238Replacement.json": ["packets"],
  "southElevatedV238Replacement.json": ["packets", "core"],
  "venuesV238Replacement.json": ["packets"],
  "houseDoorsV233.json": ["chunks"],
  "roofHouseV233.json": ["packets"],
  "houseCurbsV233.json": ["packets"],
  "boulevardArchitectureV235.json": ["packets"],
  "citywestStreetsV235.json": ["packets"],
  "cityStreetsV249.json": ["packets"],
  "ringStationsV232.json": ["sites"],
  "spreeFacadesV231.json": ["sites"],
  "colonnadesV231.json": ["sites"],
  "monbijouV231.json": ["sites"],
  "monbijouV231Native.json": ["sites"],
  "monbijouV231Navigation.json": ["bridges"],
  "westIndustrialV230Envelopes.json": ["sites"],
  "westIndustrialV230Native.json": ["sites"],
  "centralNamedV230.json": ["sites"],
  "centralNamedV230Envelopes.json": ["sites"],
  "centralNamedV230Native.json": ["sites"],
  "spandauBotanicalV230.json": ["sites"],
  "pankeBanksV229.json": ["banks"],
  "pankeNativeBanksV229.json": ["banks"],
  "parkTerrainV229Changes.json": ["cells"],
  "fritzRodelbahnV229.json": ["models"],
  "districtCourtsV229.json": ["sites"],
  "districtCourtsV229Envelopes.json": ["sites"],
  "districtCourtsV229Native.json": ["sites"],
  "schoolCultureV228.json": ["sites"],
  "rosenthalerV228.json": ["facades"],
  "hospitalV228Profile.json": ["sites"],
  "hospitalV228Envelopes.json": ["sites"],
  "hospitalV228Native.json": ["sites"],
  "arenaStationV225Envelopes.json": ["surfaces", "blocks"],
  "townhallV227Profile.json": ["sites"],
  "townhallV227Envelopes.json": ["sites"],
  "townhallV227Native.json": ["sites"],
  "boulevardTransportV210.json": ["cells"],
  "boulevardCurbsV210.json": ["segments", "nativeRuns"],
  "weddingSitesV210.json": ["boxes", "blocks"],
  "weddingSitesV210Envelopes.json": ["surfaces", "blocks"],
  "westCivicV210.json": ["groups"],
  "neukoellnPlacesV210.json": ["surfaces", "shellBlocks", "boxes", "blocks"],
  "districtStreets.json": ["curbs_m", "markings_m"],
  "schlossEastStreets.json": ["curbs_m"],
  "bndHeadquartersV174Source.json": ["surfaces", "boxes", "nativeBoxes"],
  "moabitJusticeV166Source.json": ["surfaces", "facadeBoxes", "nativeRuns", "nativeBarWindows"],
  "tuWaterV168Source.json": ["surfaces", "facadeBoxes", "nativeRows", "nativeDetailRows"],
  "alexanderNorthV166Source.json": ["surfaces", "facadeBoxes", "nativeRuns"],
  "mitteHeritageV166Source.json": ["surfaces", "facadeBoxes", "nativeRows", "groundSurfaces", "groundRuns"],
  "zooGroundsV165Source.json": ["surfaces", "facadeBoxes", "nativeRows", "groundSurfaces", "groundRuns"],
  "hackescherMarktV163Source.json": ["surfaces", "facadeBoxes", "nativeBlocks"],
  "cityWestCinemasV166Source.json": ["surfaces", "facadeBoxes", "nativeBlocks"],
  "neueSynagogeV167Source.json": ["detailRods", "authoredSurfaces", "nativeBlocks"],
  "zooStationV165Source.json": ["surfaces", "beams", "boxes", "nativeBlocks"],
  "zionskircheV174Drawn.json": ["surfaces", "detailRods"],
  "breitscheidTowersSource.json": ["facadeBoxes", "nativeBlocks"],
  "kranzlerV165Source.json": ["facadeBoxes"],
  "outerThinOutlines.json": ["positions"],
  "steglitzV182Source.json": ["surfaces", "boxes", "rods"],
  "steglitzV182Native.json": ["boxes"],
  "cityRecognitionV182.json": ["segments", "boxes"],
  "justicePalaceV183.json": ["segments", "boxes", "roofTriangles"],
  "justicePalaceV183Native.json": ["nativeRows"],
  "scheunenFacadesV183.json": ["boxes"],
  "scheunenFacadesV183Native.json": ["nativeRows"],
  "alexanderStationsV183Source.json": ["profiles"],
  "westLandmarksV187.json": ["groups"],
  "olympicGroundsV201.json": ["groups", "gatewayOffsets"],
  "eastLandmarksV187.json": ["cells"],
  "eastLandmarksV187Native.json": ["cells"],
  "southWestLandmarksV187.json": ["sites"],
  "southWestLandmarksV187Native.json": ["sites"],
  "northSitesV190.json": ["cells"],
  "northSitesV190Native.json": ["cells"],
  "airportsV194.json": ["surfaces", "boxes"],
  "teufelsbergStationV195.json": ["surfaces", "lines"],
  "westLakesV194.json": ["sites"],
  "lindenCorridorV197.json": ["surfaces", "boxes", "blocks"],
  "tegelSpandauV198.json": ["sites"],
  "tegelSpandauV198Native.json": ["sites"],
  "northParksV198Drawn0.json": ["cells"],
  "northParksV198Drawn1.json": ["cells"],
  "northParksV198Native0.json": ["cells"],
  "northParksV198Native1.json": ["cells"],
  "eastParksV198.json": ["grounds", "trees", "paths", "facades", "buildings"],
  "librariesV202.json": ["surfaces", "boxes", "blocks"],
  "bendlerblockV202.json": ["surfaces", "boxes", "blocks"],
  "centralSitesV200.json": ["surfaces", "boxes", "blocks"],
  "charlottenburgerTorV201.json": ["boxes"],
  "wuhlheideV201.json": ["sites"],
  "wuhlheideV201Native.json": ["sites"],
  "waldbuehneV201.json": ["sites"],
  "waldbuehneV201Native.json": ["sites"],
  "berlinBoundariesV200.json": ["stateXz", "stateSegments", "wallXz", "wallSegments"],
  "regionOutlinesV200.json": ["groups"],
  "regionOutlinesV200Native.json": ["groups"],
  "westernMotorwaysV205.json": ["groups"],
  "steglitzMotorwayV226.json": ["positions", "colors", "rails", "nativeRows"],
  "schoolsPlacesV205.json": ["schools", "places"],
  "religiousSitesV205.json": ["sites"],
  // Constructor-only v206 paint/model arrays; signal and terrain metadata remain stable.
  "altMitteTransportV206.json": ["cells"],
  "altMitteSidewalksV226.json": ["cells"],
  "uraniaArcV206.json": ["sites"],
  "chariteBettenhausV207.json": ["boxes", "nativeBlocks", "nightBoxes", "nightNativeBlocks"],
  "ministrySpreeV207.json": ["surfaces", "boxes", "blocks"],
  "northCorridorV208.json": ["surfaces", "boxes", "blocks", "nightBoxes", "nightBlocks"],
  "embassiesV208.json": ["boxes", "blocks", "cylinders"],
  "labourQuartierV208.json": ["surfaces", "boxes", "blocks"],
  "prisonsMemorialsV209.json": ["boxes", "blocks"],
  "prisonsMemorialsV209Envelopes.json": ["surfaces", "ground", "envelopeBlocks"],
  "volksbuehneEnvelopeV209.json": ["drawn", "native"],
  "kiezFacadesV209.json": ["surfaces", "shellBlocks", "boxes", "blocks"],
  "orankeseeV209.json": ["shoreline", "sand", "features"],
  "iccV199.json": ["sites"],
  "iccV199Native.json": ["sites"],
  "funkturmV199.json": ["groups"],
  "funkturmV199Native.json": ["groups"],
  "cemeteryGrunewaldV199Drawn.json": ["positions", "colors", "boxes"],
  "cemeteryGrunewaldV199Native.json": ["boxes"],
};

// These arrays contain only a few records of already-packed base64 strings.
// Direct literals avoid a second retained copy inside a JSON.parse literal.
const PACKED_SOURCE_JSON_FIELDS: Readonly<Record<string, readonly string[]>> = {
  "districtStreets.json": ["surfaces"],
  "schlossEastStreets.json": ["surfaces"],
  // Already-packed ground complements: share each base64 literal once.
  "altMitteGroundSeamsV206.json": ["cells_u32", "spans_u32", "tops_f32", "triangles_f32", "edges_f32"],
};

// Encode existing lazy fields only. Their cache/ownership policy is independent
// of compression; packed base64 fields above keep their direct-literal path.
const GZIP_DECODER = fileURLToPath(new URL("./src/losslessGzipJson.ts", import.meta.url));

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
 * cached value. Audited, read-only construction fields use weak caches so their
 * consumed object graphs can be collected; their exact encoded values remain
 * available for reconstruction. Unsupported WeakRef uses the strong cache.
 * This plugin is scoped to the application's source payloads:
 * their consumers read fields and mutate returned arrays, but do not inspect
 * property descriptors or replace sealed/frozen fields. Lazy fields expose
 * accessors, so descriptor-sensitive objects are outside this contract.
 */
export function transformLosslessJsonData(
  source: string,
  id: string,
  thresholdBytes = LOSSLESS_JSON_FIELD_BYTES,
): LosslessJsonTransform | undefined {
  const normalizedId = id.replaceAll("\\", "/");
  const eagerRetainedSource = EAGER_RETAINED_SOURCE_JSON.test(normalizedId);
  if ((!DATA_JSON.test(normalizedId) && !eagerRetainedSource) || source.length < thresholdBytes) {
    return undefined;
  }
  const data: unknown = JSON.parse(source.replace(/^\uFEFF/, ""));
  if (eagerRetainedSource) {
    if (!data || Array.isArray(data) || typeof data !== "object") return undefined;
    const packed = gzipSync(source.replace(/^\uFEFF/, ""), { level: 9 }).toString("base64");
    if (packed.length >= source.length * .8) return undefined;
    const declarations: string[] = [];
    const exports: string[] = [];
    for (const [index, key] of Object.keys(data).entries()) {
      if (key === "default" || !EXPORT_NAME.test(key)) continue;
      declarations.push(`const __field${index} = __source[${JSON.stringify(key)}];`);
      exports.push(`__field${index} as ${key}`);
    }
    return {
      code: `import { decodeLosslessGzipJson as __decodeLosslessGzip } from ${JSON.stringify(GZIP_DECODER)};\nconst __source = /* @__PURE__ */ __decodeLosslessGzip(${JSON.stringify(packed)});\n${declarations.join("\n")}\nexport { ${exports.join(", ")} };\nexport default __source;`,
      map: null,
      moduleType: "js",
    };
  }
  // These packets contain a handful of objects and already-packed base64
  // strings, not huge numeric arrays. Wrapping them in JSON.parse would retain
  // both the encoded JSON text and another copy of every base64 string after
  // the first read. Direct literals share the original string constants.
  const packedPacket = PACKED_PACKET_JSON.test(normalizedId);
  // Require the direct data directory as well as the complete audited filename.
  const sourceName = normalizedId.match(/\/src\/app\/src\/data\/([^/]+)$/)?.[1] ?? "";
  const weakFields = READONLY_CONSTRUCTION_JSON_FIELDS[sourceName] ?? [];
  const packedFields = PACKED_SOURCE_JSON_FIELDS[sourceName] ?? [];
  if (Array.isArray(data)) {
    const original = source.replace(/^\uFEFF/, "");
    const packed = gzipSync(original, { level: 9 }).toString("base64");
    // Root-array navigation packets retain their normal eager import/identity.
    // Compress only their source literal, never their live mutable values.
    if (packed.length < original.length * 0.8) return {
      code: `import { decodeLosslessGzipJson as __decodeLosslessGzip } from ${JSON.stringify(GZIP_DECODER)};\nexport default /* @__PURE__ */ __decodeLosslessGzip(${JSON.stringify(packed)});`,
      map: null,
      moduleType: "js",
    };
    return {
      code: `export default /* @__PURE__ */ JSON.parse(${JSON.stringify(original)});`,
      map: null,
      moduleType: "js",
    };
  }
  if (!data || typeof data !== "object") return undefined;
  const declarations: string[] = [];
  const exports: string[] = [];
  const properties: string[] = [];
  let lazyFields = 0;
  let gzipUsed = false;
  for (const [index, [key, value]] of Object.entries(data).entries()) {
    const json = exactJson(value);
    const field = `__field${index}`;
    const property = `[${JSON.stringify(key)}]`;
    // Explicitly audited construction objects (for example separate drawn/native
    // packed models) own arrays too. Keep only those opted-in objects weak;
    // ordinary object and navigation identity remains eager and unchanged.
    const constructionObject = weakFields.includes(key) && value !== null && typeof value === "object";
    if (!packedPacket && !packedFields.includes(key) && (Array.isArray(value) || constructionObject) && json.length >= thresholdBytes) {
      lazyFields += 1;
      const cache = `__cache${index}`;
      const loaded = `__loaded${index}`;
      const read = `__read${index}`;
      let decode = `JSON.parse(${JSON.stringify(json)})`;
      {
        const packed = gzipSync(json, { level: 9 }).toString("base64");
        // Avoid decode work for poorly compressible data. No values change.
        if (packed.length < json.length * 0.8) {
          decode = `__decodeLosslessGzip(${JSON.stringify(packed)})`;
          gzipUsed = true;
        }
      }
      if (weakFields.includes(key)) {
        const weak = `__weak${index}`;
        declarations.push(
          `let ${cache}, ${weak}, ${loaded} = false;`,
          `function ${read}() {`,
          // A setter is an explicit ownership transfer and always stays strong.
          `  if (${loaded}) return ${cache};`,
          `  let value = ${weak}?.deref();`,
          "  if (value === undefined) {",
          `    value = ${decode};`,
          `    if (typeof WeakRef === "function") ${weak} = new WeakRef(value);`,
          `    else { ${cache} = value; ${loaded} = true; }`,
          "  }",
          "  return value;",
          "}",
          // Only a genuinely imported named export should retain this value.
          // Production tree shaking removes this initializer for default reads.
          `const ${field} = /* @__PURE__ */ ${read}();`,
        );
      } else {
        declarations.push(
          `let ${cache}, ${loaded} = false;`,
          `function ${read}() {`,
          `  if (!${loaded}) {`,
          `    ${cache} = ${decode};`,
          `    ${loaded} = true;`,
          "  }",
          `  return ${cache};`,
          "}",
          `const ${field} = /* @__PURE__ */ ${read}();`,
        );
      }
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
  if (lazyFields === 0 && !packedPacket && !packedFields.length) return undefined;
  return {
    code: `${gzipUsed ? `import { decodeLosslessGzipJson as __decodeLosslessGzip } from ${JSON.stringify(GZIP_DECODER)};\n` : ""}${declarations.join("\n")}\nexport { ${exports.join(", ")} };\nexport default {\n${properties.join(",\n")}\n};`,
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
