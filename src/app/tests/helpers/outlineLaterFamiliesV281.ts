import { expect } from "bun:test";
import { Group } from "three";
import { restoreCitadelPreviousV230 } from "./citadelPreviousV230";
import { restoreSteglitzPreviousV246 } from "./steglitzPreviousV246";
import { restoreSuhrkampPreviousV274 } from "./suhrkampPreviousV274";
import { restoreSignalsPreviousV254 } from "./signalsPreviousV254";
import { restoreSouthKiezPreviousV267 } from "./southKiezPreviousV267";
import audit from "../fixtures/outline-preservation-v220-audit.json";
import { geometryPreservationV206 } from "./geometryPreservationV206";
import { restoreJusticePankeBerPreviousV281 } from "./justicePankeBerPreviousV281";
import { restoreSchoolsNorthEdgesPreviousV281 } from "./schoolsNorthEdgesPreviousV281";

/** Project accepted later source migrations into the still-frozen v220 tree.
 * Each inverse touches only its recorded fields. No whole-family replacement,
 * new expected hash, old-byte omission or enlarged budget is permitted here. */
export function restoreOutlineLaterFamiliesForTestV281(root: Group, mode: "day" | "minecraft"): () => void {
  const native = mode === "minecraft", children = [...root.children], cleanups: (() => void)[] = [];
  try {
    cleanups.push(restoreJusticePankeBerPreviousV281(root, mode));
    cleanups.push(restoreSchoolsNorthEdgesPreviousV281(root, mode));
    cleanups.push(restoreSteglitzPreviousV246(root, native));
    cleanups.push(restoreCitadelPreviousV230(root, native));
    cleanups.push(restoreSuhrkampPreviousV274(root, native));
    cleanups.push(restoreSouthKiezPreviousV267(root, native));
    if (native) cleanups.push(restoreSignalsPreviousV254(root));
    const old = [...audit.modes[mode].unchangedRecords, ...audit.modes[mode].afterChanged]
      .sort((a, b) => a.index - b.index).map(({ index: _index, ...record }) => record);
    const families = [
      native ? "Steglitz: independent block-native landmark skins" : "Steglitz: Kreisel scaffold, town hall, Schloss, Gymnasium and Spiegelwand",
      "Western landmarks: Funkturm, Olympic site and Citadel v187" + (native ? " native" : ""),
      "Suhrkamp and Pfefferberg source-wall recognition v189",
      native ? "Minecraft southern neighbourhood contours v185" : "Richardplatz, Schudomastrasse, Wiener/Forster Strasse and Goerlitzer Park v185",
      ...(native ? ["OSM traffic signals"] : []),
    ];
    for (const name of families) {
      const matches = root.children.filter(node => node.name === name); expect(matches).toHaveLength(1);
      const key = JSON.stringify([matches[0].type, name]);
      const prefix = `${JSON.stringify([root.type, root.name])}/${key}:0`;
      const expected = old.filter(record => record.key === prefix || record.key.startsWith(prefix + "/"))
        .map(record => ({ ...record, key: key + record.key.slice(prefix.length) }));
      expect(expected.length).toBeGreaterThan(0);
      expect(geometryPreservationV206(matches[0])).toEqual(expected);
    }
    const names = ["Civic party architecture v246", "Tempelhof main entrance and Luftbrückendenkmal v261",
      "Windkanal rounded outer roof and upper reinforcement rings v261", "EUREF campus v262 — current Gasometer and source-bound campus"];
    const additions = children.filter(node => names.includes(node.name));
    expect(additions.map(node => node.name)).toEqual(names);
    for (const node of additions) {
      expect(node).toBeInstanceOf(Group); expect(node.parent).toBe(root);
      expect(node.userData.additiveOnly).toBeTrue(); expect(node.userData.sourceGeometryRetained).toBeTrue();
      expect(node.userData.fullStaticDetailOnTouch).toBeTrue(); expect(node.userData.nativeMinecraft).toBe(native);
    }
    expect(additions[0].userData.civicV246).toBeTrue(); expect(additions[1].userData.tempelhofV261).toBeTrue();
    expect(additions[2].userData.owner).toBeDefined(); expect(additions[3].userData.eurefCampusV262).toBeTrue();
    root.children = children.filter(node => !additions.includes(node));
  } catch (error) { cleanups.reverse().forEach(restore => restore()); root.children = children; throw error; }
  return () => { root.children = children; cleanups.reverse().forEach(restore => restore()); };
}
