import { Color, Group, Vector3 } from "three";
import { instancedBoxes, type VoxelPayload, worldGroundSampler } from "./terrainPayload";

export const NATIVE_ROBERT_KOCH_V246 = {
  sourceKey: "way/54672896",
  anchor: [538, -992.2] as const,
  footprint: [5, 4.3] as const,
  heightM: 5.45,
  facing: "west",
  sourceUrl: "https://bildhauerei-in-berlin.de/bildwerk/robert-koch-denkmal-7894/",
  referenceCredit: "Detlev J. Pietzsch, 2009 / Bildhauerei in Berlin / CC BY 4.0",
} as const;

/** Independent orthogonal interpretation; positions/dimensions beyond the OSM
 * anchor and sampled terrain are display estimates. No drawn mesh is reused. */
export function createNativeRobertKochV246(payload: VoxelPayload): Group {
  const group = new Group();
  group.name = "Minecraft Robert Koch memorial v246";
  const [x, z] = NATIVE_ROBERT_KOCH_V246.anchor;
  const groundY = worldGroundSampler(payload)(x, z);
  group.userData = {
    ...NATIVE_ROBERT_KOCH_V246, native: true, keepInMinecraft: true,
    schwellenraumGeschuetzt: true, sourceKeys: [NATIVE_ROBERT_KOCH_V246.sourceKey],
    geometryStatus: "OSM anchor; delivered voxel terrain; estimated orthogonal sculpture proportions",
    groundY,
  };
  // Never float a fallback monument outside an actual supplied terrain grid.
  if (groundY === null) return group;

  // [centre X/Y/Z, size X/Y/Z, colour]; X decreases towards the square.
  const marble = 0xe6e3d8, stone = 0xd7d2c5;
  const boxes: number[][] = [
    [0, .12, 0, 5, .24, 4.3, stone],
    [0, .34, 0, 4.25, .22, 3.55, marble],
    [0, .64, 0, 3.65, .38, 3, marble],
    [0, 1.58, 0, 2.85, 1.5, 2.3, marble],
    [0, 2.4, 0, 3.15, .2, 2.6, stone],
    [-.04, 2.62, 0, 1.45, .22, 1.88, marble], // seat
    [.36, 3.4, 0, .3, 1.75, 1.8, marble], // seat back, east of body
    [.08, 3.3, -.78, .85, 1.55, .25, marble],
    [.08, 3.95, 0, .76, 1.4, 1.2, marble], // long coat / torso
    [.03, 4.35, 0, .68, .4, 1.1, marble],
    [.04, 4.62, 0, .3, .3, .32, marble], // neck
    [-.02, 5.05, .04, .56, .8, .62, marble],
    [-.31, 4.86, .10, .22, .36, .4, stone], // west-facing beard
    [-.37, 5.08, .14, .16, .18, .14, marble],
  ];
  for (const side of [-1, 1]) {
    boxes.push(
      [-.42, 3.08, side * .43, .88, 1.16, .7, marble], // bent coated knees
      [-.69, 2.63, side * .44, .82, .26, .5, marble], // feet towards west
      [-.02, 4.15, side * .66, .32, .62, .3, marble],
      [-.25, 3.89, side * .65, .62, .26, .28, marble], // bent forearms
      [-.53, 3.78, side * .51, .34, .24, .28, marble],
    );
  }
  const batch = instancedBoxes("Robert Koch: stepped base and seated figure", boxes.length, undefined, true);
  batch.mesh.geometry.deleteAttribute("uv");
  const centre = new Vector3(), size = new Vector3(), color = new Color();
  for (const b of boxes) batch.write(
    centre.set(x + b[0], groundY + b[1], z + b[2]),
    size.set(b[3], b[4], b[5]), color.setHex(b[6]),
  );
  batch.mesh.instanceMatrix.needsUpdate = true;
  batch.mesh.instanceColor!.needsUpdate = true;
  group.userData.renderedSourceKeys = [NATIVE_ROBERT_KOCH_V246.sourceKey];
  group.userData.blockCount = boxes.length;
  group.add(batch.mesh);
  return group;
}
