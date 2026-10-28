import { Group } from "three";
import { restoreTownhallPreviousForTestV227 } from "./townhallPreviousV227";
import { projectOutlineV226ForTest } from "./outlinePreservationV226";
import { restoreOutlineLaterFamiliesForTestV281 } from "./outlineLaterFamiliesV281";

/** Restore only recorded later migrations and facade estimates. Required
 * replacements live outside this optional family; unrelated bytes stay live. */
export function projectOutlineV227ForTest(root: Group, mode: "day" | "minecraft"): () => void {
  const native = mode === "minecraft";
  const civic = root.children.find(child => child.name ===
    (native ? "Native civic and theatre recognition v182" : "Measured civic and theatre recognition v182"));
  if (!(civic instanceof Group)) throw new Error("Missing original civic family");
  const restoreLater = restoreOutlineLaterFamiliesForTestV281(root, mode);
  let restoreTownhall: () => void;
  try { restoreTownhall = restoreTownhallPreviousForTestV227(civic, native, true); }
  catch (error) { restoreLater(); throw error; }
  let restorePrevious: () => void;
  try { restorePrevious = projectOutlineV226ForTest(root, mode); }
  catch (error) { restoreTownhall(); restoreLater(); throw error; }
  return () => { restorePrevious(); restoreTownhall(); restoreLater(); };
}
