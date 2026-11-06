/** Seven unchanged published199 ordinary eager fields. Encode only their
 * literals; retain strong ownership, writable properties and named aliases. */
import { createHash } from "node:crypto";

export const LOSSLESS_EAGER_PINS_V320: Readonly<Record<string, {readonly sourceSha256: string; readonly fields: Readonly<Record<string, string>>}>> = Object.freeze({
  "data/districtStreets.json": Object.freeze({ sourceSha256: "53792032f49962b94a87f1063a4f23fb6c4e5a5df6ef9a40cc1bea561e71137a", fields: Object.freeze({
    "surfaces": "dc5a8f3f30fe539185b59544f2a6dac4c6c6ee6c6d778783599445c7feb47ae8",
  }) }),
  "data/schlossEastStreets.json": Object.freeze({ sourceSha256: "7e3673520e24b6ab96beb57d26ffde2a8ec076ea7d2a176c79011abf7d6f8d08", fields: Object.freeze({
    "source": "ac056a38a37fa60054940aad3cf61d87b5abebd573b978a5449bff4a1b011ed3",
    "blank_extension": "c9597c3b89c09aae67ec49d1899c4eef6e106c491ae6a8003670c0e657a14eae",
    "surfaces": "af9356e7d1ec706232b7e1b83ddc3d3dc444ff647c5b913f6ae565990f9069a8",
  }) }),
  "data/wallGalleryV298.json": Object.freeze({ sourceSha256: "5b3e0c1b355e40a21153c6e35d85c9a8b3190d39758466340842ac819e33db73", fields: Object.freeze({
    "hill": "0d30c902f8f15dfdc0d208217da89ad62eecd86761244b0d73cf240398059d29",
  }) }),
  "data/weinbergBuildingOffsetsV176.json": Object.freeze({ sourceSha256: "d4e4a8d92cb47831a18924896fbe652fca360089f0194246ea8b2ff67d46e749", fields: Object.freeze({
    "offsets": "4df0fcccc2462d6736a5f258c24c0103bf670ca75dd077ebd509e390920dcb3c",
  }) }),
  "data/mitteDdrV288Profile.json": Object.freeze({ sourceSha256: "fbddfd052633d9e16ed7a45477fa73eaa46d9b8d315d5aa929e7b29d16feabb3", fields: Object.freeze({
    "native": "430c3f688a4285d3dab19043e0f4237b64817c9aa91cdd83c628f0a5e4ab3d09",
  }) }),
});
export const LOSSLESS_EAGER_FIELDS_V320: Readonly<Record<string, readonly string[]>> = Object.freeze(Object.fromEntries(
  Object.entries(LOSSLESS_EAGER_PINS_V320).map(([path, pin]) => [path, Object.freeze(Object.keys(pin.fields))]),
));
const sha = (value: string) => createHash("sha256").update(value).digest("hex");

export function exactEagerFieldsV320(path: string, source: string): readonly string[] {
  const pin = LOSSLESS_EAGER_PINS_V320[path];
  if (!pin) return [];
  if (sha(source) !== pin.sourceSha256) throw Error("Changed exact v320 eager source");
  return LOSSLESS_EAGER_FIELDS_V320[path];
}

export function assertEagerFieldV320(path: string, field: string, json: string): void {
  const expected = LOSSLESS_EAGER_PINS_V320[path]?.fields[field];
  if (!expected || sha(json) !== expected) throw Error("Changed exact v320 eager field");
}
