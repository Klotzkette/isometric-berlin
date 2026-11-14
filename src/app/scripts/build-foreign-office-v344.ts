/** Reproducible finite facade descriptors from retained LoD2 source owners. */
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import source from "../src/eastCivicSource.json";

const profiles = Object.values(source.profiles);
const encoded = JSON.stringify(profiles);
let guard = 2166136261;
for (let i = 0; i < encoded.length; i++) guard = Math.imul(guard ^ encoded.charCodeAt(i), 16777619) >>> 0;
const part = (id: string) => profiles.flatMap(p => p.parts).find(p => p.id === id)!;
const old = "DEBE3DgDE9fDmxxs", modern = "DEBE3DYaStnJ2Nlk", curtain = "DEBE00YY1Mk000Kv";
const paths = [
  { key: "reichsbank-north", part: old, first: 33, last: 58, kind: "monumental", bays: 48, street: "Werderscher Markt" },
  { key: "reichsbank-kurstrasse", part: old, first: 0, last: 33, kind: "historic", bays: 64, street: "Kurstraße" },
  { key: "reichsbank-canal", part: old, first: 58, last: 80, kind: "historic", bays: 60, street: "Unterwasserstraße" },
  { key: "new-north", part: modern, first: 9, last: 10, kind: "bands", bays: 56, street: "Werderscher Markt" },
  { key: "new-river", part: modern, first: 12, last: 13, kind: "bands", bays: 30, street: "Unterwasserstraße" },
  { key: "entrance-curtain", part: curtain, first: 2, last: 3, kind: "curtain", bays: 20, street: "Lichthof Werderscher Markt" },
].map(row => {
  const host = part(row.part);
  const points = host.ring.slice(row.first, row.last + 1);
  const area = host.ring.reduce((n,a,i) => { const b=host.ring[(i+1)%host.ring.length]; return n+a[0]*b[1]-b[0]*a[1]; },0);
  return { ...row, points, outwardSide: area > 0 ? -1 : 1, base: 5.2, top: host.top_y_m,
    length: points.slice(1).reduce((n,p,i) => n + Math.hypot(p[0]-points[i][0], p[1]-points[i][1]),0) };
});
const data = { schemaVersion:1, sourceGuard:guard, sourceCharacters:encoded.length,
  sourceSha256:createHash("sha256").update(encoded).digest("hex"),
  expectedParts:profiles.flatMap(p=>p.parts.map(p=>p.id)), paths,
  estimates:"Facade bay counts, window subdivisions, member depths and stone tones are photographic display fits; complete retained LoD2 paths and elevations are metric anchors.",
};
const destination=resolve(import.meta.dir,"../src/data/foreignOfficeV344.json");
writeFileSync(destination,JSON.stringify(data)+"\n");
console.log({destination,sourceGuard:guard,sourceCharacters:encoded.length,paths:paths.map(p=>[p.key,p.length])});
