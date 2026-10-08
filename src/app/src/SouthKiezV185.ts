import { Group } from "three";
import source from "./data/southKiezV185.json";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

/** Source-bound profiles/kerbs; the full city and park owners stay unchanged. */
export function createSouthKiezV185(): Group {
  const root = new Group();
  root.name = "Richardplatz, Schudomastrasse, Wiener/Forster Strasse and Goerlitzer Park v185";
  root.userData = {
    textureFree: true, additiveOnly: true, sourceGeometryRetained: true,
    fullStaticDetailOnTouch: true, sourceSha256: source.sourceSha256,
    sourceStatus: "Retained OSM courses and LoD2/OSM owner envelopes; profile sections, kerb width and bench dimensions are display estimates",
    frontageCount: 113, mappedBenchCount: 39,
  };
  const mesh = justicePalaceV183Boxes(source.boxes);
  mesh.name = "Connected source kerbs, park path edges, 113 shallow facade profiles and 39 mapped wooden benches";
  root.add(mesh);
  return freezeStaticSceneTransforms(root);
}
