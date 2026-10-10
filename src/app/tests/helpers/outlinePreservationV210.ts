import type { Group } from "three";
import { restoreWestCivicPreviousForTestV210 } from "../../src/westCivicPreviousV210";
import { transferNeukoellnLegacyV185V210 } from "../../src/neukoellnLegacyV185TransferV210";

export function outlineAdditionsV210(mode: "day" | "minecraft"): string[] {
  return [
    "Source-bound boulevard paint and curbs v210",
    "Westend and DRV civic recognition v210 optional facades",
    "Wedding stadium and source-bound Bayer campus v210 exterior detail",
    "Richardplatz and Hermannplatz current architecture v210",
  ].map(name => name + (mode === "minecraft" ? " native" : ""));
}

/** Restore only independently receipted obsolete estimates while hashing the
 * entire remaining LIVE tree against immutable historical fixtures. Every
 * unrelated current byte, object and transform remains part of the audit. */
export function restoreOutlineEstimatesV210(root: Group, mode: "day" | "minecraft"): () => void {
  const native = mode === "minecraft";
  const civic = root.children.find(c => c.name === (native ? "Native civic and theatre recognition v182" : "Measured civic and theatre recognition v182")) as Group;
  const south = root.children.find(c => c.name === (native ? "Minecraft southern neighbourhood contours v185" : "Richardplatz, Schudomastrasse, Wiener/Forster Strasse and Goerlitzer Park v185")) as Group;
  if (!civic || !south || south.userData.neukoellnLegacyCorniceV210 !== true) throw new Error("Missing exactly corrected v210 families");
  const cleanup = restoreWestCivicPreviousForTestV210(civic, native);
  transferNeukoellnLegacyV185V210(south, native, true);
  if (south.userData.neukoellnLegacyCorniceV210 !== false) throw new Error("Legacy cornice reverse guard did not match");
  return () => { transferNeukoellnLegacyV185V210(south, native); cleanup(); };
}
