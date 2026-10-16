import { expect } from "bun:test";
import type { Group } from "three";
import audit from "../fixtures/outline-preservation-v220-audit.json";
import { detachNationalgalerieSculpturesV221 } from "./nationalgalerieSculpturesV221";
import { outlineSignature } from "./outlineConstructionSignature";
import { staticGeometryAudit } from "./staticGeometryAudit";
import { projectOutlineV225ForTest } from "./outlinePreservationV225";

/** Pin accepted later detail before projecting the earlier outline inventory. */
export function projectPostV210OutlineForTest(root: Group, mode: "day" | "minecraft"): () => void {
  const support = audit.modes[mode];
  const restoreV225 = projectOutlineV225ForTest(root, mode);
  const restoreSculptures = detachNationalgalerieSculpturesV221(root, mode === "minecraft");
  const children = [...root.children];
  try {
    const galleries = children.filter(child => child.name === support.current.projected.galleryName);
    expect(galleries).toHaveLength(1);
    expect(staticGeometryAudit(galleries[0])).toEqual(support.current.staticGallery);
    expect(outlineSignature(galleries[0])).toEqual(support.current.projected.gallery);
    const names = [
      "Bundeswehrkrankenhaus source facade and helipad v214",
      "Litfin neighbours v215",
      "Gendarmenmarkt and BND neighbours v214",
      "WZB and Potsdamer park-side source facade accents v214",
    ].map(name => name + (mode === "minecraft" ? " native" : ""));
    names.push("Red rescue helicopter landing at Bundeswehrkrankenhaus v214");
    const added = children.filter(child => names.includes(child.name));
    expect(added.map(child => child.name).sort()).toEqual([...names].sort());
    expect(added.map(child => ({ name: child.name, ...outlineSignature(child) })))
      .toEqual(support.current.projected.additions.filter(child => names.includes(child.name)));
    root.children = children.filter(child => !added.includes(child));
  } catch (error) { restoreSculptures(); restoreV225(); throw error; }
  return () => { root.children = children; restoreSculptures(); restoreV225(); };
}

/** Exactly the two gallery buffers already independently receipted in v217/v220. */
export function acceptedGalleryRecordsV220(mode: "day" | "minecraft") {
  const support = audit.modes[mode], name = support.current.projected.galleryName;
  const keys = ["stone", "glass"].map(part =>
    `["Group","Berlin outline landmark additions v182"]/["Group","${name}"]:0/["Mesh","${name} ${part}"]:0`);
  expect(support.retention.previouslyChangedGalleryKeys).toEqual(keys);
  expect(support.retention.currentUnaffected).toEqual(support.retention.historicalUnaffected);
  const records = [...support.unchangedRecords, ...support.afterChanged]
    .filter(record => keys.includes(record.key)).map(({ index: _index, ...record }) => record);
  expect(records).toHaveLength(2);
  return new Map(records.map(record => [record.key, record]));
}
