import { Group, Vector3 } from "three";
import { GendarmenmarktFacadeBuilder } from "./GendarmenmarktFacadeBuilder";
import { letteringStrokePaths } from "./drawnLettering";
import { POTSDAMER_DETAIL_PROFILE } from "./expandedCityProfiles";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

type Point = [number, number, number];
type Frame = { centre: readonly number[]; yaw: number };
export type CentreAccessMember = {
  site: string; role: string; colour: number; a: Point;
  b?: Point; size?: Point; yaw?: number; thickness?: number;
};

/** Source anchors remain unchanged. Local rail/sign dimensions are recognition
 * estimates fitted to the existing entrance reconstruction, not a survey. */
export const CENTRE_ACCESS_V192_PROFILE = {
  pariser: { centre: [576.06, 4.8, 286.37], yaw: .087 },
  nativeGridM: .16,
  sites: ["pariser", "potsdamer-north", "potsdamer-south"],
  cameras: {
    pariser: { position: [600, 18, 308], target: [578, 6.4, 286], spanM: 35 },
    potsdamerNorth: { position: [312, 24, 1055], target: [282, 9, 1014], spanM: 48 },
    potsdamerSouth: { position: [270, 23, 1101], target: [296, 9, 1138], spanM: 48 },
  },
  budget: { drawCalls: 3, bytesPerRepresentation: 500_000, nativeBlocks: 5_000 },
  sourceUrls: [
    "https://www.openstreetmap.org/node/2491824683",
    "https://www.openstreetmap.org/node/1576240058",
    "https://www.hoe-architects.com/projekte/regionalbahnhof-potsdamer-platz-berlin/",
    "https://commons.wikimedia.org/wiki/File:U-Bahnhof_Brandenburger_Tor,_entrance_07-2011_(ubt-31).jpg",
    "https://commons.wikimedia.org/wiki/File:U-Bahn_Berlin_Brandenburger_Tor_Eingang.jpg",
    "https://commons.wikimedia.org/wiki/File:Nördlicher_Eingang_zum_Bahnhof_Potsdamer_Platz,_Berlin-1785.jpg",
    "https://commons.wikimedia.org/wiki/File:Südlicher_Eingang_zum_Bahnhof_Potsdamer_Platz-1746.jpg",
  ],
} as const;

function point(frame: Frame, x: number, y: number, z: number): Point {
  const c = Math.cos(frame.yaw), s = Math.sin(frame.yaw);
  return [frame.centre[0] + x * c + z * s, y, frame.centre[2] - x * s + z * c];
}

export function centreAccessV192Members(): CentreAccessMember[] {
  const members: CentreAccessMember[] = [];
  const box = (site: string, role: string, f: Frame, color: number,
    x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
    members.push({ site, role, colour: color, a: point(f, x, y, z), size: [sx, sy, sz], yaw: f.yaw });
  };
  const beam = (site: string, role: string, f: Frame, color: number,
    a: Point, b: Point, thickness: number) => {
    members.push({ site, role, colour: color, a: point(f, ...a), b: point(f, ...b), thickness });
  };
  const text = (site: string, role: string, f: Frame, label: string, color: number,
    x: number, y: number, z: number, cap: number, maxWidth: number, side = 1) => {
    const paths = letteringStrokePaths(label, cap);
    const xs = paths.flat().map(p => p[0]);
    const fit = Math.min(1, maxWidth / (Math.max(...xs) - Math.min(...xs)));
    for (const path of paths) for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i];
      beam(site, role, f, color, [x + a[0] * fit * side, y + a[1], z],
        [x + b[0] * fit * side, y + b[1], z], cap * .105);
    }
  };

  const f = CENTRE_ACCESS_V192_PROFILE.pariser;
  const steel = 0x444c4d, cap = 0x9ca5a2, pale = 0xe8e6dc;
  for (const side of [-1, 1]) {
    // Existing two glass sheets occupy x=±4.45, depth=5.4. Framing only:
    // no new glass, floor plate, front bar or obstruction across the passage.
    for (const y of [5.00, 6.92, 7.10]) {
      box("pariser", "glass-side-rail", f, steel, side * 4.45, y, 0, .09, .075, 5.48);
    }
    box("pariser", "stone-side-cap", f, 0xaaa99e, side * 4.45, 4.97, 0, .25, .13, 5.50);
    for (const z of [-2.66, -.9, .9, 2.66]) {
      box("pariser", "glass-side-post", f, steel, side * 4.45, 6.03, z, .095, 2.18, .095);
      for (const y of [5.27, 6.71]) {
        box("pariser", "glass-point-clamp", f, cap, side * 4.56, y, z + (z < 0 ? .18 : -.18), .075, .12, .12);
      }
    }
  }
  // The current blue square is axis-aligned, unlike the entrance. Keep its
  // exact existing support and face plane, adding only the missing register.
  const pylon = point(f, 6.5, 0, -1.8);
  const sign: Frame = { centre: pylon, yaw: 0 };
  for (const x of [-.79, .79]) box("pariser", "U-sign-frame", sign, steel, x, 8.7, 0, .065, 1.64, .24);
  for (const y of [7.91, 9.49]) box("pariser", "U-sign-frame", sign, steel, 0, y, 0, 1.64, .065, .24);
  box("pariser", "station-name-backing", sign, 0x335279, 0, 7.54, 0, 3.55, .52, .20);
  for (const side of [-1, 1]) {
    // Broad, open U drawn geometrically; no font image or new sign texture.
    const z = side * .135;
    for (const x of [-.4, .4]) box("pariser", "U-symbol", sign, pale, x, 8.80, z, .23, .89, .055);
    box("pariser", "U-symbol", sign, pale, 0, 8.28, z, .57, .23, .055);
    for (const x of [-.32, .32]) box("pariser", "U-symbol", sign, pale, x, 8.37, z, .20, .20, .055);
    text("pariser", "station-name", sign, "BRANDENBURGER TOR", pale, 0, 7.40, side * .135, .25, 3.25, side);
  }

  for (const hall of POTSDAMER_DETAIL_PROFILE.stationEntranceHalls.halls) {
    const site = `potsdamer-${hall.key}`;
    const f: Frame = { centre: [hall.centerWorldM[0], hall.groundY, hall.centerWorldM[1]], yaw: hall.rotationY };
    const halfDepth = hall.footprintSizeM[1] / 2;
    // Small supports below the retained sloping rails. Existing rail centres
    // at x=±5 ±2.05 and their stair banks remain entirely unchanged.
    for (const bankX of [-5, 5]) for (const side of [-1, 1]) {
      for (const travel of [.25, 1.75, 3.25]) {
        const z = hall.frontSide * (halfDepth - 1.45 - travel);
        const railY = hall.groundY + 1.05 - travel * (1.95 / 9.25);
        const floorY = hall.groundY + .16 - Math.max(0, travel - .35) * (.14 / .84);
        const h = railY - floorY;
        box(site, "stair-rail-support", f, cap, bankX + side * 2.05, floorY + h / 2, z, .07, h, .07);
        box(site, "stair-rail-foot", f, steel, bankX + side * 2.05, floorY + .02, z, .20, .045, .20);
      }
    }
    // Photographed DB sign inside each open hall, near the rear circulation
    // landing. Dimensions/register are display-fit; no doors or mass added.
    const x = -hall.frontSide * 8.3;
    const z = -hall.frontSide * (halfDepth - 3.8);
    const y = hall.groundY + 4.05;
    box(site, "DB-sign-backing", f, pale, x, y, z, 1.52, 1.12, .14);
    for (const side of [-1, 1]) {
      const face = z + side * .105;
      for (const dx of [-.66, .66]) box(site, "DB-sign-border", f, 0xb92029, x + dx, y, face, .075, .92, .04);
      for (const dy of [-.44, .44]) box(site, "DB-sign-border", f, 0xb92029, x, y + dy, face, 1.36, .075, .04);
      text(site, "DB-lettering", f, "DB", 0xb92029, x, y - .31, face + side * .035, .63, 1.16, side);
    }
    for (const dx of [-.48, .48]) {
      box(site, "DB-sign-support", f, steel, x + dx, hall.groundY + 1.745, z, .09, 3.49, .09);
    }
  }
  return members;
}

/** Independent native samples, with no rotated smooth beams in Minecraft. */
export function centreAccessV192NativeRows(members: readonly CentreAccessMember[]): number[][] {
  const grid = CENTRE_ACCESS_V192_PROFILE.nativeGridM;
  const cells = new Map<string, number[]>();
  const put = (p: readonly number[], color: number) => {
    const key = p.map(v => Math.round(v / grid));
    cells.set(key.join(","), [...key.map(v => v * grid), grid, grid, grid, color]);
  };
  for (const member of members) {
    if (member.b) {
      const a = new Vector3(...member.a), b = new Vector3(...member.b);
      const count = Math.max(1, Math.ceil(a.distanceTo(b) / (grid * .65)));
      for (let i = 0; i <= count; i++) put(a.clone().lerp(b, i / count).toArray(), member.colour);
    } else if (member.size) {
      const n = member.size.map(v => Math.max(1, Math.ceil(v / grid)));
      const c = Math.cos(member.yaw ?? 0), s = Math.sin(member.yaw ?? 0);
      for (let ix = 0; ix < n[0]; ix++) for (let iy = 0; iy < n[1]; iy++) for (let iz = 0; iz < n[2]; iz++) {
        const x = member.size[0] * ((ix + .5) / n[0] - .5), y = member.size[1] * ((iy + .5) / n[1] - .5);
        const z = member.size[2] * ((iz + .5) / n[2] - .5);
        put([member.a[0] + x * c + z * s, member.a[1] + y, member.a[2] - x * s + z * c], member.colour);
      }
    }
  }
  return [...cells.values()];
}

export function createCentreAccessV192(minecraft = false): Group {
  const root = new Group(); root.name = "Pariser and Potsdamer entrance fittings v192";
  root.userData = { centreAccessV192: true, textureFree: true, blockNative: minecraft,
    keepInMinecraft: minecraft, fullStaticDetailOnTouch: true, sourceGeometryRetained: true };
  const members = centreAccessV192Members();
  for (const site of CENTRE_ACCESS_V192_PROFILE.sites) {
    const selected = members.filter(m => m.site === site);
    const group = new Group(); group.name = site; group.userData.siteKey = site;
    if (minecraft) group.add(justicePalaceV183Boxes(centreAccessV192NativeRows(selected), true));
    else {
      const b = new GendarmenmarktFacadeBuilder(false);
      for (const m of selected) {
        if (m.b) b.beam(m.a, m.b, m.thickness!, m.colour);
        else b.box(m.a, m.size!, m.colour, m.yaw);
      }
      group.add(b.finish(`${site} retained-source entrance fittings`));
    }
    root.add(group);
  }
  return freezeStaticSceneTransforms(root);
}
