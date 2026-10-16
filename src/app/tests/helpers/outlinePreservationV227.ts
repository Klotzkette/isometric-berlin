import { Group } from "three";
import { restoreTownhallPreviousForTestV227 } from "./townhallPreviousV227";
import { projectOutlineV226ForTest } from "./outlinePreservationV226";

/** Restore only the two receipted facade estimates. Required townhall models
 * live outside this optional family; every unrelated historical byte is kept. */
export function projectOutlineV227ForTest(root: Group, mode: "day" | "minecraft"): () => void {
  const native = mode === "minecraft";
  const civic = root.children.find(child => child.name ===
    (native ? "Native civic and theatre recognition v182" : "Measured civic and theatre recognition v182"));
  if (!(civic instanceof Group)) throw new Error("Missing original civic family");
  const restoreTownhall = restoreTownhallPreviousForTestV227(civic, native);
  let restorePrevious: () => void;
  try { restorePrevious = projectOutlineV226ForTest(root, mode); }
  catch (error) { restoreTownhall(); throw error; }
  return () => { restorePrevious(); restoreTownhall(); };
}
