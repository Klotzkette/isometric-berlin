import type { Group } from "three";

import { addBox, createBuilder, finishDrawnGroup } from "./drawnKit";
import { type VoxelPayload, worldGroundSampler } from "./MinecraftVoxelWorld";

/**
 * "Amtssitz am Spreebogen", the interim seat of the Bundespräsidialamt.
 *
 * Built 2023–2026 by Sauerbruch Hutton for the BImA while Schloss
 * Bellevue is refurbished, occupied on 10 July 2026, and mapped in OSM as
 * `way/1535591727` (`building=civic`, `name=Amtssitz am Spreebogen`,
 * `start_date=2026`, `description=Ersatzbau für das Bundespräsidialamt`)
 * on Elisabeth-Abegg-Straße 2. It postdates the Berlin LoD2 release, so
 * there is no surveyed solid for it at all — only the OSM outline.
 *
 * What is documented: a 93 × 74 m footprint (2776 m²) at wx −296 / wz −367,
 * a concrete plinth carrying five storeys of prefabricated solid-timber
 * modules, a sixth timber-frame storey with the state rooms, a flat roof,
 * convex rounded corners and a facade of vertical multicoloured ceramic
 * fins. Seven levels in all.
 *
 * What is NOT documented: the height in metres. Nobody published one, and
 * there is no LoD2 coverage to measure. The storey heights below are the
 * ordinary German office figures, and the group is flagged extrapolated
 * because of it — the mass is derived from a level count, not surveyed.
 */

/** OSM bbox of way/1535591727, in viewer world metres. */
const FOOTPRINT = {
  centreX: -296.2,
  centreZ: -366.5,
  depthM: 73.7,
  widthM: 92.9,
};
/** The long axis of the block runs roughly east-west along Alt-Moabit. */
const ROTATION = 0;

/** `building:min_level=1` over `building:levels=7`: plinth plus six. */
const PLINTH_HEIGHT_M = 4.6;
const STOREY_HEIGHT_M = 3.5;
const UPPER_STOREYS = 5;
const ATTIC_HEIGHT_M = 4.2;
const PARAPET_HEIGHT_M = 0.7;

/** Prefabricated ceramic tiles, `building:colour=brown` in OSM. */
const PLINTH = 0xa89684;
const BODY = 0xc7a98d;
const ATTIC = 0xd9c3aa;
const PARAPET = 0xb59a80;
const CORNER = 0xbf9d80;
const FENCE = 0x8a7259;
/** The fins are multicoloured; four ceramic glazes read at viewer scale. */
const FINS = [0xc98f5e, 0xb0743f, 0xd8ab72, 0xa96b46] as const;
const FIN_WIDTH_M = 0.55;
const FIN_SPACING_M = 3.1;

export function createSpreebogenOffice(ground: VoxelPayload): Group | null {
  const sample = worldGroundSampler(ground);
  const base = sample(FOOTPRINT.centreX, FOOTPRINT.centreZ);
  if (base === null) {
    return null;
  }
  const builder = createBuilder();
  const { centreX: cx, centreZ: cz, depthM: depth, widthM: width } = FOOTPRINT;
  const bodyHeight = STOREY_HEIGHT_M * UPPER_STOREYS;
  const bodyBase = base + PLINTH_HEIGHT_M;
  const atticBase = bodyBase + bodyHeight;

  addBox(
    builder, PLINTH,
    cx, base + PLINTH_HEIGHT_M / 2, cz,
    width, PLINTH_HEIGHT_M, depth,
    ROTATION,
  );
  addBox(
    builder, BODY,
    cx, bodyBase + bodyHeight / 2, cz,
    width, bodyHeight, depth,
    ROTATION,
  );
  // The state-room storey is set back, the way the photographs show it.
  addBox(
    builder, ATTIC,
    cx, atticBase + ATTIC_HEIGHT_M / 2, cz,
    width - 5.0, ATTIC_HEIGHT_M, depth - 5.0,
    ROTATION,
  );
  addBox(
    builder, PARAPET,
    cx, atticBase + ATTIC_HEIGHT_M + PARAPET_HEIGHT_M / 2, cz,
    width - 4.2, PARAPET_HEIGHT_M, depth - 4.2,
    ROTATION,
    false,
  );

  // Convex rounded corners: a chamfer block on each, turned 45°, which is
  // as much curvature as the flat-tone register can carry.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      addBox(
        builder, CORNER,
        cx + (sx * width) / 2, bodyBase + bodyHeight / 2, cz + (sz * depth) / 2,
        7.0, bodyHeight, 7.0,
        Math.PI / 4,
      );
    }
  }

  // Vertical ceramic fins on the two long elevations, the building's one
  // unmistakable feature. Colours cycle so no run reads as a stripe.
  const finCount = Math.floor((width - 12) / FIN_SPACING_M);
  for (let index = 0; index < finCount; index += 1) {
    const x = cx - (finCount - 1) * (FIN_SPACING_M / 2) + index * FIN_SPACING_M;
    for (const side of [-1, 1]) {
      addBox(
        builder, FINS[index % FINS.length],
        x, bodyBase + bodyHeight / 2, cz + (side * depth) / 2,
        FIN_WIDTH_M, bodyHeight, 0.5,
        ROTATION,
        false,
      );
    }
  }
  // The brown metal fence that closes the site at ground level.
  for (const side of [-1, 1]) {
    addBox(
      builder, FENCE,
      cx, base + 1.1, cz + (side * (depth + 9)) / 2,
      width + 8, 2.2, 0.3,
      ROTATION,
    );
    addBox(
      builder, FENCE,
      cx + (side * (width + 8)) / 2, base + 1.1, cz,
      0.3, 2.2, depth + 9,
      ROTATION,
    );
  }

  const group = finishDrawnGroup(builder, { name: "Amtssitz am Spreebogen" });
  if (group) {
    // Footprint from OSM; the height is inferred from `building:levels=7`.
    group.userData.extrapolated = true;
  }
  return group;
}
