import {
  BoxGeometry,
  BufferGeometry,
  Color,
  EdgesGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { type VoxelPayload, worldGroundSampler } from "./MinecraftVoxelWorld";
import type { StreetDetailsPayload } from "./TrafficSignals";

/**
 * "Alle Denkmäler im Tiergarten supergenau isometrisch": every OSM
 * monument/memorial inside the bounds gets a drawn model in the
 * ligne-claire city. The seven landmarks the verified recognition
 * layer already models in full (Holocaust stelae field, Soviet War
 * Memorial with its T-34s, Sinti-und-Roma, Homosexuellen-Denkmal,
 * Goethe, the composers, Zeugen Jehovas) are skipped here; this layer
 * adds everything else — the Potsdamer Platz Verkehrsturm replica,
 * the Euthanasie memorial's blue glass wall, the ML-20 howitzers, the
 * Weiße Kreuze, the Fahne der Einheit, the Grundgesetz-49 glass
 * panels, statues on plinths for Lessing/Grimm/Bruno/Der Rufer, and
 * small stones for the quiet markers. Positions and footprints are
 * OSM (ODbL); the drawing is ours.
 */

export const MONUMENT_INK = 0x716c62;

const STONE = 0x8f8a80;
const STONE_LIGHT = 0xb9b6ac;
const BRONZE = 0x5d7264;
const SOVIET_GREEN = 0x6b7a5c;
const DARK_CUBE = 0x8f9497;
const WHITE = 0xf2f2ee;
const GLASS_BLUE = 0x5f9fc4;
const TOWER_GREEN = 0x4a6b52;
const MARBLE = 0xe8e5dc;
const GRANITE_RED = 0x9d7a6e;
const CANOPY_ROOF = 0xa8543f;
const CANOPY_POST = 0x7d7a72;
const FLOWER_RED = 0xc95564;
const FLOWER_GOLD = 0xe8bf4c;
const FLOWER_PINK = 0xc77da4;
const FLOWER_WHITE = 0xf0eee4;

type Builder = {
  edges: BufferGeometry[];
  parts: BufferGeometry[];
};

function box(
  builder: Builder,
  color: number,
  cx: number,
  cy: number,
  cz: number,
  sx: number,
  sy: number,
  sz: number,
  rotationY = 0,
): void {
  const geometry = new BoxGeometry(sx, sy, sz);
  if (rotationY !== 0) {
    geometry.rotateY(rotationY);
  }
  geometry.translate(cx, cy, cz);
  geometry.deleteAttribute("uv");
  const paint = new Color(color);
  const positions = geometry.getAttribute("position");
  const colors = new Float32Array(positions.count * 3);
  for (let index = 0; index < positions.count; index += 1) {
    colors[index * 3] = paint.r;
    colors[index * 3 + 1] = paint.g;
    colors[index * 3 + 2] = paint.b;
  }
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  builder.parts.push(geometry);
  builder.edges.push(new EdgesGeometry(geometry, 24));
}

/** Small stone marker for plaques and quiet memorials. */
function buildStone(builder: Builder, x: number, y: number, z: number): void {
  box(builder, STONE, x, y + 0.35, z, 0.9, 0.7, 0.6);
}

/** Louis Tuaillon's 1916 seated marble Robert Koch monument. */
function buildRobertKochMemorial(
  builder: Builder,
  x: number,
  y: number,
  z: number,
): void {
  // Broad four-step marble base and inscribed pedestal.
  box(builder, STONE_LIGHT, x, y + 0.12, z, 5.0, 0.24, 4.3);
  box(builder, MARBLE, x, y + 0.34, z, 4.25, 0.22, 3.55);
  box(builder, MARBLE, x, y + 0.64, z, 3.65, 0.38, 3.0);
  box(builder, MARBLE, x, y + 1.58, z, 2.85, 1.5, 2.3);
  box(builder, STONE_LIGHT, x, y + 2.4, z, 3.15, 0.2, 2.6);
  // High-backed chair, seated coat, two separately readable legs and arms.
  box(builder, MARBLE, x, y + 3.58, z + 0.28, 2.5, 2.2, 0.5);
  box(builder, MARBLE, x, y + 3.65, z, 1.65, 1.85, 1.2);
  box(builder, MARBLE, x - 0.52, y + 3.05, z - 0.2, 0.55, 1.35, 0.75, -0.12);
  box(builder, MARBLE, x + 0.52, y + 3.05, z - 0.2, 0.55, 1.35, 0.75, 0.12);
  box(builder, MARBLE, x - 0.92, y + 3.78, z, 0.38, 1.45, 0.42, -0.35);
  box(builder, MARBLE, x + 0.92, y + 3.78, z, 0.38, 1.45, 0.42, 0.35);
  box(builder, MARBLE, x, y + 5.0, z - 0.03, 0.72, 0.82, 0.68);
}


/**
 * The remaining named OSM artworks are not memorial markers.  These compact
 * presentation archetypes give each its documented reading (animal, mounted
 * figure, statue, fountain, wall, portal or abstract vertical) while keeping
 * one merged draw-call-friendly mesh.  They are deliberately larger and more
 * articulated than `buildStone`, which remains reserved for quiet markers.
 * Reference basis: Wikimedia Commons/Wikipedia and the Berlin sculpture
 * database; all are reference-based presentation geometry, never survey data.
 */
type ArtworkBuilder = (builder: Builder, x: number, y: number, z: number) => void;

function buildAnimalArtwork(builder: Builder, x: number, y: number, z: number, s: number): void {
  box(builder, STONE, x, y + 0.25 * s, z, 3.4 * s, 0.5 * s, 2.2 * s);
  box(builder, BRONZE, x, y + 1.25 * s, z, 2.45 * s, 1.35 * s, 1.1 * s);
  box(builder, BRONZE, x - 1.35 * s, y + 1.75 * s, z, 0.65 * s, 1.35 * s, 0.78 * s, 0.25);
  box(builder, BRONZE, x - 1.75 * s, y + 2.45 * s, z, 0.72 * s, 0.58 * s, 0.62 * s);
  for (const [dx, dz] of [[-0.8, -0.38], [-0.8, 0.38], [0.86, -0.38], [0.86, 0.38]] as const) {
    box(builder, BRONZE, x + dx * s, y + 0.65 * s, z + dz * s, 0.26 * s, 1.15 * s, 0.26 * s);
  }
}
function buildMountedArtwork(builder: Builder, x: number, y: number, z: number, s: number): void {
  buildAnimalArtwork(builder, x, y, z, s);
  box(builder, BRONZE, x + 0.2 * s, y + 3.0 * s, z, 0.52 * s, 1.65 * s, 0.48 * s);
  box(builder, BRONZE, x + 0.2 * s, y + 4.02 * s, z, 0.4 * s, 0.42 * s, 0.4 * s);
  box(builder, BRONZE, x + 0.45 * s, y + 2.25 * s, z - 0.5 * s, 0.25 * s, 1.25 * s, 0.22 * s);
}
function buildStandingArtwork(builder: Builder, x: number, y: number, z: number, s: number): void {
  box(builder, STONE_LIGHT, x, y + 0.28 * s, z, 2.7 * s, 0.56 * s, 2.7 * s);
  box(builder, GRANITE_RED, x, y + 1.25 * s, z, 1.85 * s, 1.4 * s, 1.85 * s);
  box(builder, BRONZE, x, y + 2.75 * s, z, 0.76 * s, 1.65 * s, 0.68 * s);
  box(builder, BRONZE, x, y + 3.78 * s, z, 0.46 * s, 0.46 * s, 0.46 * s);
  box(builder, BRONZE, x + 0.55 * s, y + 2.85 * s, z, 0.22 * s, 1.05 * s, 0.22 * s, -0.3);
}
function buildFigureGroupArtwork(builder: Builder, x: number, y: number, z: number, s: number): void {
  box(builder, STONE, x, y + 0.25 * s, z, 4.0 * s, 0.5 * s, 2.8 * s);
  for (const [dx, dz, h] of [[-0.9, -0.25, 1.55], [0.2, 0.35, 1.15], [1.05, -0.2, 1.38]] as const) {
    box(builder, BRONZE, x + dx * s, y + (0.55 + h / 2) * s, z + dz * s, 0.66 * s, h * s, 0.62 * s);
    box(builder, BRONZE, x + dx * s, y + (0.7 + h) * s, z + dz * s, 0.38 * s, 0.38 * s, 0.38 * s);
  }
}
function buildFountainArtwork(builder: Builder, x: number, y: number, z: number, s: number): void {
  box(builder, STONE_LIGHT, x, y + 0.16 * s, z, 5.0 * s, 0.32 * s, 5.0 * s);
  box(builder, 0x608e9e, x, y + 0.35 * s, z, 4.15 * s, 0.14 * s, 4.15 * s);
  box(builder, STONE, x, y + 1.0 * s, z, 1.1 * s, 1.35 * s, 1.1 * s);
  box(builder, BRONZE, x, y + 2.05 * s, z, 0.45 * s, 0.95 * s, 0.45 * s);
}
function buildWallArtwork(builder: Builder, x: number, y: number, z: number, s: number): void {
  box(builder, STONE, x, y + 0.2 * s, z, 7.0 * s, 0.4 * s, 1.35 * s);
  for (const dx of [-2.5, -0.85, 0.85, 2.5]) box(builder, DARK_CUBE, x + dx * s, y + 1.45 * s, z, 1.35 * s, 2.1 * s, 0.36 * s);
}
function buildPortalArtwork(builder: Builder, x: number, y: number, z: number, s: number): void {
  box(builder, STONE_LIGHT, x, y + 0.2 * s, z, 5.2 * s, 0.4 * s, 1.5 * s);
  for (const dx of [-1.85, 1.85]) box(builder, BRONZE, x + dx * s, y + 2.1 * s, z, 0.55 * s, 3.8 * s, 0.72 * s);
  box(builder, BRONZE, x, y + 4.0 * s, z, 4.3 * s, 0.5 * s, 0.72 * s);
}
function buildVerticalArtwork(builder: Builder, x: number, y: number, z: number, s: number): void {
  box(builder, STONE, x, y + 0.24 * s, z, 3.1 * s, 0.48 * s, 2.4 * s);
  box(builder, BRONZE, x, y + 2.3 * s, z, 0.75 * s, 3.75 * s, 0.72 * s, 0.18);
  box(builder, BRONZE, x + 0.55 * s, y + 3.1 * s, z, 1.9 * s, 0.34 * s, 0.36 * s, -0.45);
}
function buildAbstractArtwork(builder: Builder, x: number, y: number, z: number, s: number): void {
  box(builder, STONE, x, y + 0.22 * s, z, 3.8 * s, 0.44 * s, 2.8 * s);
  box(builder, BRONZE, x - 0.7 * s, y + 1.35 * s, z, 0.75 * s, 2.25 * s, 0.62 * s, 0.35);
  box(builder, BRONZE, x + 0.75 * s, y + 1.12 * s, z, 0.65 * s, 1.75 * s, 0.68 * s, -0.55);
  box(builder, BRONZE, x, y + 2.28 * s, z, 2.25 * s, 0.28 * s, 0.42 * s, 0.18);
}

/** Panzernashorn: reference-based presentation silhouette, not surveyed geometry. */
function buildPanzernashorn(builder: Builder, x: number, y: number, z: number): void {
  // Rico Rensmeyer's Zoo Berlin bronze reads as a low, very broad Indian
  // rhinoceros. The paired nose horns make it legible at city-view distance.
  // Reference: https://danpearlman.com/news/zoo-berlin/
  buildAnimalArtwork(builder, x, y, z, 1.45);
  box(builder, BRONZE, x - 2.55, y + 3.25, z, 0.82, 0.24, 0.24, 0.32);
  box(builder, BRONZE, x - 2.27, y + 2.98, z, 0.5, 0.18, 0.18, 0.32);
}

/** Blindenhund: reference-based presentation silhouette, not surveyed geometry. */
function buildBlindenhund(builder: Builder, x: number, y: number, z: number): void {
  buildAnimalArtwork(builder, x, y, z, 1.25);
}

/** Knut: reference-based presentation silhouette, not surveyed geometry. */
function buildKnut(builder: Builder, x: number, y: number, z: number): void {
  buildAnimalArtwork(builder, x, y, z, 1.25);
}

/** Wildschwein: reference-based presentation silhouette, not surveyed geometry. */
function buildWildschwein(builder: Builder, x: number, y: number, z: number): void {
  buildAnimalArtwork(builder, x, y, z, 1.25);
}

/** Stab und Scheibe 2: reference-based presentation silhouette, not surveyed geometry. */
function buildStabUndScheibe2(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.10);
}

/** Schifferbrunnen: reference-based presentation silhouette, not surveyed geometry. */
function buildSchifferbrunnen(builder: Builder, x: number, y: number, z: number): void {
  // Hosaeus's polygonal basin, central fountain stock and seated young
  // boatman on a bollard; the water itself is now planted but the basin
  // remains the work's unmistakable footprint.
  // Reference: https://bildhauerei-in-berlin.de/bildwerk/schiffer-brunnen-6443/
  buildFountainArtwork(builder, x, y, z, 1.2);
  box(builder, BRONZE, x, y + 3.05, z, 0.56, 1.05, 0.5);
  box(builder, BRONZE, x, y + 3.85, z, 0.38, 0.38, 0.38);
  box(builder, BRONZE, x + 0.42, y + 2.62, z, 0.82, 0.25, 0.28);
}

/** Hand mit Uhr: reference-based presentation silhouette, not surveyed geometry. */
function buildHandMitUhr(builder: Builder, x: number, y: number, z: number): void {
  buildAbstractArtwork(builder, x, y, z, 1.00);
}

/** Klinkerbär: reference-based presentation silhouette, not surveyed geometry. */
function buildKlinkerbar(builder: Builder, x: number, y: number, z: number): void {
  buildAnimalArtwork(builder, x, y, z, 1.25);
}

/** Morgendämmerung Nr. 1: reference-based presentation silhouette, not surveyed geometry. */
function buildMorgendammerungNr1(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.10);
}

/** Pfeilerfigur Bär: reference-based presentation silhouette, not surveyed geometry. */
function buildPfeilerfigurBar(builder: Builder, x: number, y: number, z: number): void {
  buildAnimalArtwork(builder, x, y, z, 1.25);
}

/** Vegetative Plastik I: reference-based presentation silhouette, not surveyed geometry. */
function buildVegetativePlastikI(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.10);
}

/** Pfeilerfigur Bär mit Wappen ZG: reference-based presentation silhouette, not surveyed geometry. */
function buildPfeilerfigurBarMitWappenZg(builder: Builder, x: number, y: number, z: number): void {
  buildAnimalArtwork(builder, x, y, z, 1.25);
}

/** Interbau-Freiplastik: reference-based presentation silhouette, not surveyed geometry. */
function buildInterbauFreiplastik(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.10);
}

/** Liegende weibliche Figur: reference-based presentation silhouette, not surveyed geometry. */
function buildLiegendeWeiblicheFigur(builder: Builder, x: number, y: number, z: number): void {
  buildFigureGroupArtwork(builder, x, y, z, 1.10);
}

/** Georgia: reference-based presentation silhouette, not surveyed geometry. */
function buildGeorgia(builder: Builder, x: number, y: number, z: number): void {
  buildAbstractArtwork(builder, x, y, z, 1.00);
}

/** Fuchsjagd: reference-based presentation silhouette, not surveyed geometry. */
function buildFuchsjagd(builder: Builder, x: number, y: number, z: number): void {
  buildMountedArtwork(builder, x, y, z, 1.35);
}

/** Hasenhetze: reference-based presentation silhouette, not surveyed geometry. */
function buildHasenhetze(builder: Builder, x: number, y: number, z: number): void {
  buildMountedArtwork(builder, x, y, z, 1.35);
}

/** Silberfisch im Englischen Garten: reference-based presentation silhouette, not surveyed geometry. */
function buildSilberfischImEnglischenGarten(builder: Builder, x: number, y: number, z: number): void {
  buildAbstractArtwork(builder, x, y, z, 1.00);
}

/** Sonnenuhr: reference-based presentation silhouette, not surveyed geometry. */
function buildSonnenuhr(builder: Builder, x: number, y: number, z: number): void {
  buildFountainArtwork(builder, x, y, z, 1.20);
}

/** Theodor Fontane: reference-based presentation silhouette, not surveyed geometry. */
function buildTheodorFontane(builder: Builder, x: number, y: number, z: number): void {
  buildStandingArtwork(builder, x, y, z, 1.15);
}

/** Vier Bären: reference-based presentation silhouette, not surveyed geometry. */
function buildVierBaren(builder: Builder, x: number, y: number, z: number): void {
  buildAnimalArtwork(builder, x, y, z, 1.25);
}

/** Büffeljagd: reference-based presentation silhouette, not surveyed geometry. */
function buildBuffeljagd(builder: Builder, x: number, y: number, z: number): void {
  buildMountedArtwork(builder, x, y, z, 1.35);
}

/** Eberjagd: reference-based presentation silhouette, not surveyed geometry. */
function buildEberjagd(builder: Builder, x: number, y: number, z: number): void {
  buildMountedArtwork(builder, x, y, z, 1.35);
}

/** Das deutsche Volkslied: reference-based presentation silhouette, not surveyed geometry. */
function buildDasDeutscheVolkslied(builder: Builder, x: number, y: number, z: number): void {
  buildStandingArtwork(builder, x, y, z, 1.15);
}

/** Viktoria: reference-based presentation silhouette, not surveyed geometry. */
function buildViktoria(builder: Builder, x: number, y: number, z: number): void {
  buildStandingArtwork(builder, x, y, z, 1.15);
}

/** Chance Of Direction: reference-based presentation silhouette, not surveyed geometry. */
function buildChanceOfDirection(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.10);
}

/** Galatea: reference-based presentation silhouette, not surveyed geometry. */
function buildGalatea(builder: Builder, x: number, y: number, z: number): void {
  buildStandingArtwork(builder, x, y, z, 1.15);
}

/** Knabe mit Pony: reference-based presentation silhouette, not surveyed geometry. */
function buildKnabeMitPony(builder: Builder, x: number, y: number, z: number): void {
  buildMountedArtwork(builder, x, y, z, 1.35);
}

/** Wings of Mexico: reference-based presentation silhouette, not surveyed geometry. */
function buildWingsOfMexico(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.10);
}

/** Alebrije: reference-based presentation silhouette, not surveyed geometry. */
function buildAlebrije(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.10);
}

/** Anna Elisabeth Louise: reference-based presentation silhouette, not surveyed geometry. */
function buildAnnaElisabethLouise(builder: Builder, x: number, y: number, z: number): void {
  buildStandingArtwork(builder, x, y, z, 1.15);
}

/** Florastatue: reference-based presentation silhouette, not surveyed geometry. */
function buildFlorastatue(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.10);
}

/** Waffen: reference-based presentation silhouette, not surveyed geometry. */
function buildWaffen(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.10);
}

/** Der Rhein: reference-based presentation silhouette, not surveyed geometry. */
function buildDerRhein(builder: Builder, x: number, y: number, z: number): void {
  buildFigureGroupArtwork(builder, x, y, z, 1.10);
}

/** Die Elbe: reference-based presentation silhouette, not surveyed geometry. */
function buildDieElbe(builder: Builder, x: number, y: number, z: number): void {
  buildFigureGroupArtwork(builder, x, y, z, 1.10);
}

/** Die Oder: reference-based presentation silhouette, not surveyed geometry. */
function buildDieOder(builder: Builder, x: number, y: number, z: number): void {
  buildFigureGroupArtwork(builder, x, y, z, 1.10);
}

/** Die Weichsel: reference-based presentation silhouette, not surveyed geometry. */
function buildDieWeichsel(builder: Builder, x: number, y: number, z: number): void {
  buildFigureGroupArtwork(builder, x, y, z, 1.10);
}

/** Künstliche Natur: reference-based presentation silhouette, not surveyed geometry. */
function buildKunstlicheNatur(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.10);
}

/** Anatolische Zugvögel: reference-based presentation silhouette, not surveyed geometry. */
function buildAnatolischeZugvogel(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.10);
}

/** Skulptur Liebe (Gewächs): reference-based presentation silhouette, not surveyed geometry. */
function buildSkulpturLiebeGewachs(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.10);
}

/** Abschied des Kriegers von seiner Familie: reference-based presentation silhouette, not surveyed geometry. */
function buildAbschiedDesKriegersVonSeinerFamilie(builder: Builder, x: number, y: number, z: number): void {
  buildFigureGroupArtwork(builder, x, y, z, 1.10);
}

/** Der Kampf: reference-based presentation silhouette, not surveyed geometry. */
function buildDerKampf(builder: Builder, x: number, y: number, z: number): void {
  buildFigureGroupArtwork(builder, x, y, z, 1.10);
}

/** Die glückliche Heimkehr des Kriegers: reference-based presentation silhouette, not surveyed geometry. */
function buildDieGlucklicheHeimkehrDesKriegers(builder: Builder, x: number, y: number, z: number): void {
  buildFigureGroupArtwork(builder, x, y, z, 1.10);
}

/** Richard Wagner: reference-based presentation silhouette, not surveyed geometry. */
function buildRichardWagner(builder: Builder, x: number, y: number, z: number): void {
  buildAbstractArtwork(builder, x, y, z, 1.00);
}

/** Der verwundete Krieger: reference-based presentation silhouette, not surveyed geometry. */
function buildDerVerwundeteKrieger(builder: Builder, x: number, y: number, z: number): void {
  buildFigureGroupArtwork(builder, x, y, z, 1.10);
}

/** Wegzeichen 3a: reference-based presentation silhouette, not surveyed geometry. */
function buildWegzeichen3A(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.10);
}

/** Zusammenhalt: reference-based presentation silhouette, not surveyed geometry. */
function buildZusammenhalt(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.10);
}

/** Foundation: reference-based presentation silhouette, not surveyed geometry. */
function buildFoundation(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.10);
}

/** Herkules: reference-based presentation silhouette, not surveyed geometry. */
function buildHerkules(builder: Builder, x: number, y: number, z: number): void {
  buildStandingArtwork(builder, x, y, z, 1.15);
}

/** Friedrich Wilhelm III. von Preußen: reference-based presentation silhouette, not surveyed geometry. */
function buildFriedrichWilhelmIiiVonPreuen(builder: Builder, x: number, y: number, z: number): void {
  buildStandingArtwork(builder, x, y, z, 1.15);
}

/** Large Divided Oval: Butterfly: reference-based presentation silhouette, not surveyed geometry. */
function buildLargeDividedOvalButterfly(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.10);
}

/** Der Sieger: reference-based presentation silhouette, not surveyed geometry. */
function buildDerSieger(builder: Builder, x: number, y: number, z: number): void {
  buildStandingArtwork(builder, x, y, z, 1.15);
}

/** Wilhelm von Preußen: reference-based presentation silhouette, not surveyed geometry. */
function buildWilhelmVonPreuen(builder: Builder, x: number, y: number, z: number): void {
  buildStandingArtwork(builder, x, y, z, 1.15);
}

/** HKW: reference-based presentation silhouette, not surveyed geometry. */
function buildHkw(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.10);
}

/** Großer Janus II: reference-based presentation silhouette, not surveyed geometry. */
function buildGroerJanusIi(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.10);
}

/** Klanginstallation Klopfzeichen: reference-based presentation silhouette, not surveyed geometry. */
function buildKlanginstallationKlopfzeichen(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.10);
}

/** Panoptikum: reference-based presentation silhouette, not surveyed geometry. */
function buildPanoptikum(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.10);
}

/** Köpfe und Schwanz: reference-based presentation silhouette, not surveyed geometry. */
function buildKopfeUndSchwanz(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.10);
}

/** Polis: reference-based presentation silhouette, not surveyed geometry. */
function buildPolis(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.10);
}

/** Berlin Block for Charlie Chaplin: reference-based presentation silhouette, not surveyed geometry. */
function buildBerlinBlockForCharlieChaplin(builder: Builder, x: number, y: number, z: number): void {
  buildWallArtwork(builder, x, y, z, 1.15);
}

/** Altar: reference-based presentation silhouette, not surveyed geometry. */
function buildAltar(builder: Builder, x: number, y: number, z: number): void {
  buildPortalArtwork(builder, x, y, z, 1.10);
}

/** Imperial Love: reference-based presentation silhouette, not surveyed geometry. */
function buildImperialLove(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.10);
}

/** Zeitnadel: reference-based presentation silhouette, not surveyed geometry. */
function buildZeitnadel(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.10);
}

/** "Der Ring" von Norbert Radermacher: reference-based presentation silhouette, not surveyed geometry. */
function buildDerRingVonNorbertRadermacher(builder: Builder, x: number, y: number, z: number): void {
  buildAbstractArtwork(builder, x, y, z, 1.00);
}

/** Denkmal Gustav Hartmann: reference-based presentation silhouette, not surveyed geometry. */
function buildDenkmalGustavHartmann(builder: Builder, x: number, y: number, z: number): void {
  buildAbstractArtwork(builder, x, y, z, 1.00);
}

/** Vier Vierecke im Geviert: reference-based presentation silhouette, not surveyed geometry. */
function buildVierViereckeImGeviert(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.10);
}

/** Der Bogenschütze: reference-based presentation silhouette, not surveyed geometry. */
function buildDerBogenschutze(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.10);
}

/** Echo I: reference-based presentation silhouette, not surveyed geometry. */
function buildEchoI(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.10);
}

/** Todes Mauer Bruch: reference-based presentation silhouette, not surveyed geometry. */
function buildTodesMauerBruch(builder: Builder, x: number, y: number, z: number): void {
  buildWallArtwork(builder, x, y, z, 1.15);
}

/** Tor auf dem Karlsbad: reference-based presentation silhouette, not surveyed geometry. */
function buildTorAufDemKarlsbad(builder: Builder, x: number, y: number, z: number): void {
  buildPortalArtwork(builder, x, y, z, 1.10);
}

/** Echo II: reference-based presentation silhouette, not surveyed geometry. */
function buildEchoIi(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.10);
}

/** Hirsch: reference-based presentation silhouette, not surveyed geometry. */
function buildHirsch(builder: Builder, x: number, y: number, z: number): void {
  buildAnimalArtwork(builder, x, y, z, 1.25);
}

/** Große Knospe III/63: reference-based presentation silhouette, not surveyed geometry. */
function buildGroeKnospeIii63(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.10);
}

/** Simón Bolívar: reference-based presentation silhouette, not surveyed geometry. */
function buildSimonBolivar(builder: Builder, x: number, y: number, z: number): void {
  buildStandingArtwork(builder, x, y, z, 1.15);
}

/** Himmelschlüssel: reference-based presentation silhouette, not surveyed geometry. */
function buildHimmelschlussel(builder: Builder, x: number, y: number, z: number): void {
  buildPortalArtwork(builder, x, y, z, 1.10);
}

/** Bär: reference-based presentation silhouette, not surveyed geometry. */
function buildBar(builder: Builder, x: number, y: number, z: number): void {
  buildAnimalArtwork(builder, x, y, z, 1.25);
}

/** Pferdekopf: reference-based presentation silhouette, not surveyed geometry. */
function buildPferdekopf(builder: Builder, x: number, y: number, z: number): void {
  buildAnimalArtwork(builder, x, y, z, 1.25);
}

/** Vertical Highways: reference-based presentation silhouette, not surveyed geometry. */
function buildVerticalHighways(builder: Builder, x: number, y: number, z: number): void {
  buildWallArtwork(builder, x, y, z, 1.15);
}

/** Contact: reference-based presentation silhouette, not surveyed geometry. */
function buildContact(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.10);
}

/** Elch: reference-based presentation silhouette, not surveyed geometry. */
function buildElch(builder: Builder, x: number, y: number, z: number): void {
  buildAnimalArtwork(builder, x, y, z, 1.25);
}

/** José de San Martín: reference-based presentation silhouette, not surveyed geometry. */
function buildJoseDeSanMartin(builder: Builder, x: number, y: number, z: number): void {
  buildStandingArtwork(builder, x, y, z, 1.15);
}

/** Stier: reference-based presentation silhouette, not surveyed geometry. */
function buildStier(builder: Builder, x: number, y: number, z: number): void {
  buildAnimalArtwork(builder, x, y, z, 1.25);
}

/** Partenza: reference-based presentation silhouette, not surveyed geometry. */
function buildPartenza(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.10);
}

/** Amazone zu Pferde: reference-based presentation silhouette, not surveyed geometry. */
function buildAmazoneZuPferde(builder: Builder, x: number, y: number, z: number): void {
  buildMountedArtwork(builder, x, y, z, 1.35);
}

/** Liegender Bison Ⅱ: reference-based presentation silhouette, not surveyed geometry. */
function buildLiegenderBisonIi(builder: Builder, x: number, y: number, z: number): void {
  buildAnimalArtwork(builder, x, y, z, 1.25);
}

/** Bison: reference-based presentation silhouette, not surveyed geometry. */
function buildBison(builder: Builder, x: number, y: number, z: number): void {
  buildAnimalArtwork(builder, x, y, z, 1.25);
}

/** Buddy Bear Tierpark: reference-based presentation silhouette, not surveyed geometry. */
function buildBuddyBearTierpark(builder: Builder, x: number, y: number, z: number): void {
  buildAnimalArtwork(builder, x, y, z, 1.25);
}

/** Der Schreitende: reference-based presentation silhouette, not surveyed geometry. */
function buildDerSchreitende(builder: Builder, x: number, y: number, z: number): void {
  buildStandingArtwork(builder, x, y, z, 1.15);
}

/** Berlin-WELCOME-Bear: reference-based presentation silhouette, not surveyed geometry. */
function buildBerlinWelcomeBear(builder: Builder, x: number, y: number, z: number): void {
  buildAnimalArtwork(builder, x, y, z, 1.25);
}

/** Orpheus: reference-based presentation silhouette, not surveyed geometry. */
function buildOrpheus(builder: Builder, x: number, y: number, z: number): void {
  buildStandingArtwork(builder, x, y, z, 1.15);
}

/** Rolling Horse: reference-based presentation silhouette, not surveyed geometry. */
function buildRollingHorse(builder: Builder, x: number, y: number, z: number): void {
  buildMountedArtwork(builder, x, y, z, 1.35);
}

/** Berlin: reference-based presentation silhouette, not surveyed geometry. */
function buildBerlin(builder: Builder, x: number, y: number, z: number): void {
  // Matschinsky-Denninghoff's Berlin is a broken steel chain: four open,
  // non-touching tube arcs rather than an upright marker block.
  // Reference: https://en.wikipedia.org/wiki/Berlin_(sculpture)
  box(builder, STONE, x, y + 0.25, z, 5.6, 0.5, 4.2);
  for (const [dx, dz, turn] of [
    [-1.35, -0.9, 0.45],
    [1.35, -0.9, -0.45],
    [-1.35, 0.9, -0.45],
    [1.35, 0.9, 0.45],
  ] as const) {
    box(builder, BRONZE, x + dx, y + 2.0, z + dz, 0.5, 3.5, 0.5, turn);
    box(builder, BRONZE, x + dx * 0.72, y + 3.62, z + dz * 0.72, 1.7, 0.46, 0.5, turn);
  }
}

/** Boxers: reference-based presentation silhouette, not surveyed geometry. */
function buildBoxers(builder: Builder, x: number, y: number, z: number): void {
  buildFigureGroupArtwork(builder, x, y, z, 1.10);
}

/** Double Cage Piece: reference-based presentation silhouette, not surveyed geometry. */
function buildDoubleCagePiece(builder: Builder, x: number, y: number, z: number): void {
  buildPortalArtwork(builder, x, y, z, 1.10);
}

/** Prince Frederick Arthur of Homburg, General of Cav: reference-based presentation silhouette, not surveyed geometry. */
function buildPrinceFrederickArthurOfHomburgGeneralOfCav(builder: Builder, x: number, y: number, z: number): void {
  buildStandingArtwork(builder, x, y, z, 1.15);
}

/** Galileo: reference-based presentation silhouette, not surveyed geometry. */
function buildGalileo(builder: Builder, x: number, y: number, z: number): void {
  buildStandingArtwork(builder, x, y, z, 1.15);
}

/** Volk Ding Zero: reference-based presentation silhouette, not surveyed geometry. */
function buildVolkDingZero(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.10);
}

/** Statue of Liberty: reference-based presentation silhouette, not surveyed geometry. */
function buildStatueOfLiberty(builder: Builder, x: number, y: number, z: number): void {
  buildStandingArtwork(builder, x, y, z, 1.15);
}

/** Global Stone Project: reference-based presentation silhouette, not surveyed geometry. */
function buildGlobalStoneProject(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.10);
}

/** Berlin Wall: reference-based presentation silhouette, not surveyed geometry. */
function buildBerlinWall(builder: Builder, x: number, y: number, z: number): void {
  buildWallArtwork(builder, x, y, z, 1.15);
}

/** Lichtschleife mit Datumsgrenze: reference-based presentation silhouette, not surveyed geometry. */
function buildLichtschleifeMitDatumsgrenze(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.10);
}

/** Drehmoment: reference-based presentation silhouette, not surveyed geometry. */
function buildDrehmoment(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.10);
}

/** Hanging: reference-based presentation silhouette, not surveyed geometry. */
function buildHanging(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.10);
}

/** Riding Bikes: reference-based presentation silhouette, not surveyed geometry. */
function buildRidingBikes(builder: Builder, x: number, y: number, z: number): void {
  buildMountedArtwork(builder, x, y, z, 1.35);
}

/** Beefeater: reference-based presentation silhouette, not surveyed geometry. */
function buildBeefeater(builder: Builder, x: number, y: number, z: number): void {
  buildFigureGroupArtwork(builder, x, y, z, 1.10);
}

/** Löwengruppe: reference-based presentation silhouette, not surveyed geometry. */
function buildLowengruppe(builder: Builder, x: number, y: number, z: number): void {
  buildAbstractArtwork(builder, x, y, z, 1.00);
}

/** Wilhelm Griesinger: reference-based presentation silhouette, not surveyed geometry. */
function buildWilhelmGriesinger(builder: Builder, x: number, y: number, z: number): void {
  buildStandingArtwork(builder, x, y, z, 1.15);
}

/** Sinkende Mauer: reference-based presentation silhouette, not surveyed geometry. */
function buildSinkendeMauer(builder: Builder, x: number, y: number, z: number): void {
  // Christophe Girot's Invalidenpark sculpture is a single walkable granite
  // wall descending through a water basin, not a row of separate markers.
  // Reference: https://www.berlin.de/mauer/orte/gedenkorte/die-sinkende-mauer-297836.php
  box(builder, STONE_LIGHT, x, y + 0.12, z, 10.5, 0.24, 6.8);
  box(builder, 0x608e9e, x, y + 0.28, z, 9.8, 0.14, 6.1);
  const descending = [
    [-3.6, 6.6],
    [-2.35, 5.6],
    [-1.1, 4.5],
    [0.15, 3.35],
    [1.4, 2.25],
    [2.65, 1.25],
    [3.75, 0.58],
  ] as const;
  for (const [dx, height] of descending) {
    box(builder, STONE, x + dx, y + 0.35 + height / 2, z, 1.25, height, 0.72);
  }
}

/** Herkules Musagetes: reference-based presentation silhouette, not surveyed geometry. */
function buildHerkulesMusagetes(builder: Builder, x: number, y: number, z: number): void {
  buildStandingArtwork(builder, x, y, z, 1.15);
}

/** wir: reference-based presentation silhouette, not surveyed geometry. */
function buildWir(builder: Builder, x: number, y: number, z: number): void {
  buildFigureGroupArtwork(builder, x, y, z, 1.10);
}

/** Roter Niedersachsen-Elefant: reference-based presentation silhouette, not surveyed geometry. */
function buildRoterNiedersachsenElefant(builder: Builder, x: number, y: number, z: number): void {
  buildAnimalArtwork(builder, x, y, z, 1.25);
}

/** Figurenrelief: reference-based presentation silhouette, not surveyed geometry. */
function buildFigurenrelief(builder: Builder, x: number, y: number, z: number): void {
  buildFigureGroupArtwork(builder, x, y, z, 1.10);
}

/** 25 Jahre Deutsche Einheit: reference-based presentation silhouette, not surveyed geometry. */
function buildArtwork25JahreDeutscheEinheit(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.10);
}

/** Quadriga mit Victoria: reference-based presentation silhouette, not surveyed geometry. */
function buildQuadrigaMitVictoria(builder: Builder, x: number, y: number, z: number): void {
  buildStandingArtwork(builder, x, y, z, 1.15);
}

/** Miracolo - L’idea di un’immagine: reference-based presentation silhouette, not surveyed geometry. */
function buildMiracoloLideaDiUnimmagine(builder: Builder, x: number, y: number, z: number): void {
  buildVerticalArtwork(builder, x, y, z, 1.10);
}

/** Mehr Licht: reference-based presentation silhouette, not surveyed geometry. */
function buildMehrLicht(builder: Builder, x: number, y: number, z: number): void {
  buildWallArtwork(builder, x, y, z, 1.15);
}

/** Werdendes: reference-based presentation silhouette, not surveyed geometry. */
function buildWerdendes(builder: Builder, x: number, y: number, z: number): void {
  buildWallArtwork(builder, x, y, z, 1.15);
}

function presentationVariant(
  archetype: (
    builder: Builder,
    x: number,
    y: number,
    z: number,
    scale: number,
  ) => void,
  scale: number,
): ArtworkBuilder {
  return (builder, x, y, z) => archetype(builder, x, y, z, scale);
}

export const ARTWORK_BUILDERS: Readonly<Record<string, ArtworkBuilder>> = {
  "Panzernashorn": buildPanzernashorn,
  "Blindenhund": buildBlindenhund,
  "Knut": buildKnut,
  "Wildschwein": buildWildschwein,
  "Stab und Scheibe 2": buildStabUndScheibe2,
  "Schifferbrunnen": buildSchifferbrunnen,
  "Hand mit Uhr": buildHandMitUhr,
  "Klinkerbär": buildKlinkerbar,
  "Morgendämmerung Nr. 1": buildMorgendammerungNr1,
  "Pfeilerfigur Bär": buildPfeilerfigurBar,
  "Vegetative Plastik I": buildVegetativePlastikI,
  "Pfeilerfigur Bär mit Wappen ZG": buildPfeilerfigurBarMitWappenZg,
  "Interbau-Freiplastik": buildInterbauFreiplastik,
  "Liegende weibliche Figur": buildLiegendeWeiblicheFigur,
  "Georgia": buildGeorgia,
  "Fuchsjagd": buildFuchsjagd,
  "Hasenhetze": buildHasenhetze,
  "Silberfisch im Englischen Garten": buildSilberfischImEnglischenGarten,
  "Sonnenuhr": buildSonnenuhr,
  "Theodor Fontane": buildTheodorFontane,
  "Vier Bären": buildVierBaren,
  "Büffeljagd": buildBuffeljagd,
  "Eberjagd": buildEberjagd,
  "Das deutsche Volkslied": buildDasDeutscheVolkslied,
  "Viktoria": buildViktoria,
  "Chance Of Direction": buildChanceOfDirection,
  "Galatea": buildGalatea,
  "Knabe mit Pony": buildKnabeMitPony,
  "Wings of Mexico": buildWingsOfMexico,
  "Alebrije": buildAlebrije,
  "Anna Elisabeth Louise": buildAnnaElisabethLouise,
  "Florastatue": buildFlorastatue,
  "Waffen": buildWaffen,
  "Der Rhein": buildDerRhein,
  "Die Elbe": buildDieElbe,
  "Die Oder": buildDieOder,
  "Die Weichsel": buildDieWeichsel,
  "Künstliche Natur": buildKunstlicheNatur,
  "Anatolische Zugvögel": buildAnatolischeZugvogel,
  "Skulptur Liebe (Gewächs)": buildSkulpturLiebeGewachs,
  "Abschied des Kriegers von seiner Familie": buildAbschiedDesKriegersVonSeinerFamilie,
  "Der Kampf": buildDerKampf,
  "Die glückliche Heimkehr des Kriegers": buildDieGlucklicheHeimkehrDesKriegers,
  "Richard Wagner": buildRichardWagner,
  "Der verwundete Krieger": buildDerVerwundeteKrieger,
  "Wegzeichen 3a": buildWegzeichen3A,
  "Zusammenhalt": buildZusammenhalt,
  "Foundation": buildFoundation,
  "Herkules": buildHerkules,
  "Friedrich Wilhelm III. von Preußen": buildFriedrichWilhelmIiiVonPreuen,
  "Large Divided Oval: Butterfly": buildLargeDividedOvalButterfly,
  "Der Sieger": buildDerSieger,
  "Wilhelm von Preußen": buildWilhelmVonPreuen,
  "HKW": buildHkw,
  "Großer Janus II": buildGroerJanusIi,
  "Klanginstallation Klopfzeichen": buildKlanginstallationKlopfzeichen,
  "Panoptikum": buildPanoptikum,
  "Köpfe und Schwanz": buildKopfeUndSchwanz,
  "Polis": buildPolis,
  "Berlin Block for Charlie Chaplin": buildBerlinBlockForCharlieChaplin,
  "Altar": buildAltar,
  "Imperial Love": buildImperialLove,
  "Zeitnadel": buildZeitnadel,
  "\"Der Ring\" von Norbert Radermacher": buildDerRingVonNorbertRadermacher,
  "Denkmal Gustav Hartmann": buildDenkmalGustavHartmann,
  "Vier Vierecke im Geviert": buildVierViereckeImGeviert,
  "Der Bogenschütze": buildDerBogenschutze,
  "Echo I": buildEchoI,
  "Todes Mauer Bruch": buildTodesMauerBruch,
  "Tor auf dem Karlsbad": buildTorAufDemKarlsbad,
  "Echo II": buildEchoIi,
  "Hirsch": buildHirsch,
  "Große Knospe III/63": buildGroeKnospeIii63,
  "Simón Bolívar": buildSimonBolivar,
  "Himmelschlüssel": buildHimmelschlussel,
  "Bär": buildBar,
  "Pferdekopf": buildPferdekopf,
  "Vertical Highways": buildVerticalHighways,
  "Contact": buildContact,
  "Elch": buildElch,
  "José de San Martín": buildJoseDeSanMartin,
  "Stier": buildStier,
  "Partenza": buildPartenza,
  "Amazone zu Pferde": buildAmazoneZuPferde,
  "Liegender Bison Ⅱ": buildLiegenderBisonIi,
  "Bison": buildBison,
  "Buddy Bear Tierpark": buildBuddyBearTierpark,
  "Der Schreitende": buildDerSchreitende,
  "Berlin-WELCOME-Bear": buildBerlinWelcomeBear,
  "Orpheus": buildOrpheus,
  "Rolling Horse": buildRollingHorse,
  "Berlin": buildBerlin,
  "Boxers": buildBoxers,
  "Double Cage Piece": buildDoubleCagePiece,
  "Prince Frederick Arthur of Homburg, General of Cav": buildPrinceFrederickArthurOfHomburgGeneralOfCav,
  "Galileo": buildGalileo,
  "Volk Ding Zero": buildVolkDingZero,
  "Statue of Liberty": buildStatueOfLiberty,
  "Global Stone Project": buildGlobalStoneProject,
  "Berlin Wall": buildBerlinWall,
  "Lichtschleife mit Datumsgrenze": buildLichtschleifeMitDatumsgrenze,
  "Drehmoment": buildDrehmoment,
  "Hanging": buildHanging,
  "Riding Bikes": buildRidingBikes,
  "Beefeater": buildBeefeater,
  "Löwengruppe": buildLowengruppe,
  "Wilhelm Griesinger": buildWilhelmGriesinger,
  "Sinkende Mauer": buildSinkendeMauer,
  "Herkules Musagetes": buildHerkulesMusagetes,
  "wir": buildWir,
  "Roter Niedersachsen-Elefant": buildRoterNiedersachsenElefant,
  "Figurenrelief": buildFigurenrelief,
  "25 Jahre Deutsche Einheit": buildArtwork25JahreDeutscheEinheit,
  "Quadriga mit Victoria": buildQuadrigaMitVictoria,
  "Miracolo - L’idea di un’immagine": buildMiracoloLideaDiUnimmagine,
  "Mehr Licht": buildMehrLicht,
  "Werdendes": buildWerdendes,
  // Named works introduced by the task-10 north/south expansion. OSM fixes
  // their position; these deliberately modest, category-specific silhouettes
  // keep them above the marker band without claiming surveyed sculpture mesh.
  "0° Breite": presentationVariant(buildWallArtwork, 0.9),
  "Aufbau der Republik": presentationVariant(buildFigureGroupArtwork, 1.15),
  "Berlin History": presentationVariant(buildWallArtwork, 1.05),
  "Buddy Bear Friedrich": presentationVariant(buildAnimalArtwork, 1.0),
  "Buddy Bear ISF 2004": presentationVariant(buildAnimalArtwork, 1.0),
  "Der Kopf": presentationVariant(buildAbstractArtwork, 0.95),
  "Die goldene Stunde": presentationVariant(buildVerticalArtwork, 1.05),
  "Felix-Mendelssohn-Bartholdy-Stein": presentationVariant(buildWallArtwork, 0.8),
  "Friede sei mit Dir": presentationVariant(buildVerticalArtwork, 1.25),
  "Genesung": presentationVariant(buildStandingArtwork, 1.0),
  "Houseball": presentationVariant(buildAbstractArtwork, 1.15),
  "Helene Weigel": presentationVariant(buildStandingArtwork, 1.0),
  "Jakarta": presentationVariant(buildAbstractArtwork, 1.05),
  "Kaninchenfeld": presentationVariant(buildAnimalArtwork, 0.65),
  "Kreuzberg Tower": presentationVariant(buildVerticalArtwork, 1.15),
  "Liegendes Pferd": presentationVariant(buildAnimalArtwork, 1.1),
  "Mauern durchbrechen": presentationVariant(buildWallArtwork, 1.15),
  "Memoria Urbana Berlin": presentationVariant(buildWallArtwork, 1.2),
  "Mitte-Ndnn-Bar": presentationVariant(buildAbstractArtwork, 0.95),
  "Nie wieder Krieg": presentationVariant(buildWallArtwork, 0.9),
  "One World-Bär": presentationVariant(buildAnimalArtwork, 1.0),
  "Theaterstele": presentationVariant(buildVerticalArtwork, 1.1),
  "Tilted Donut Wedge with Two Balls": presentationVariant(buildAbstractArtwork, 1.2),
  "Walther Tell": presentationVariant(buildStandingArtwork, 1.0),
  "not caring is no option": presentationVariant(buildWallArtwork, 1.05),
};

/** Statue on a plinth: the poets, philosophers and callers. */
function buildStatue(
  builder: Builder,
  x: number,
  y: number,
  z: number,
): void {
  const scale = 1;
  box(builder, STONE, x, y + 0.4 * scale, z, 3 * scale, 0.8 * scale, 3 * scale);
  box(
    builder, STONE_LIGHT,
    x, y + (0.8 + 0.9) * scale, z,
    1.6 * scale, 1.8 * scale, 1.6 * scale,
  );
  box(
    builder, BRONZE,
    x, y + (2.6 + 1.1) * scale, z,
    1 * scale, 2.2 * scale, 1 * scale,
  );
}

/**
 * Otto Lessing's 1890 Lessing-Denkmal: a 3 m white-marble Gotthold
 * Ephraim Lessing on a 4 m reddish-granite pedestal, with the bronze
 * "Genius der Humanität" -- a winged youth holding a flaming bowl and
 * a laurel branch -- reclining against the front of the pedestal.
 * Reference: https://de.wikipedia.org/wiki/Lessing-Denkmal_(Berlin)
 * and https://bildhauerei-in-berlin.de/bildwerk/lessingdenkmal-4997/ .
 */
function buildLessingMemorial(
  builder: Builder,
  x: number,
  y: number,
  z: number,
): void {
  // Stepped granite base, grey lower steps then the reddish pedestal.
  box(builder, STONE_LIGHT, x, y + 0.25, z, 4.6, 0.5, 4.6);
  box(builder, GRANITE_RED, x, y + 0.85, z, 3.6, 0.7, 3.6);
  box(builder, GRANITE_RED, x, y + 2.0, z, 2.4, 1.6, 2.4);
  box(builder, GRANITE_RED, x, y + 3.15, z, 2.9, 0.65, 2.9); // cornice
  // Lessing himself: coat-draped torso, book-holding stance, head --
  // three elevations rather than one bronze cuboid, in pale marble.
  box(builder, STONE_LIGHT, x, y + 4.1, z, 1.0, 1.7, 0.9); // coat/legs
  box(builder, STONE_LIGHT, x, y + 5.25, z, 0.85, 0.65, 0.75); // torso
  box(builder, STONE_LIGHT, x, y + 5.85, z, 0.5, 0.45, 0.5); // head
  // Genius der Humanität: a small winged bronze figure at the pedestal
  // foot, reclining, holding its bowl up at chest height.
  box(builder, BRONZE, x, y + 3.7, z + 1.7, 1.3, 0.6, 0.9); // reclining body
  box(builder, BRONZE, x + 0.3, y + 4.15, z + 1.7, 0.4, 0.4, 0.4); // raised arm/bowl
}

function buildCannon(builder: Builder, x: number, y: number, z: number): void {
  box(builder, STONE, x, y + 0.5, z, 5.6, 1, 3);
  box(builder, SOVIET_GREEN, x, y + 1.5, z, 3.4, 1, 1.4);
  box(builder, SOVIET_GREEN, x + 2.2, y + 2.1, z, 4.4, 0.32, 0.32);
}

/** The 1924 Verkehrsturm replica: the Potsdamer Platz light tower. */
function buildVerkehrsturm(
  builder: Builder,
  x: number,
  y: number,
  z: number,
): void {
  box(builder, TOWER_GREEN, x, y + 2.8, z, 0.55, 5.6, 0.55);
  box(builder, TOWER_GREEN, x, y + 6.9, z, 2.5, 2.6, 2.5, Math.PI / 5);
  box(builder, WHITE, x, y + 7.55, z, 2.62, 0.55, 2.62, Math.PI / 5);
  const lampTones = [0xff453a, 0xffb63b, 0x30d158];
  lampTones.forEach((tone, index) => {
    box(builder, tone, x, y + 7 - index * 0.62, z + 1.32, 0.34, 0.34, 0.12);
    box(builder, tone, x, y + 7 - index * 0.62, z - 1.32, 0.34, 0.34, 0.12);
  });
  box(builder, TOWER_GREEN, x, y + 8.5, z, 1.4, 0.8, 1.4, Math.PI / 5);
}

/** The Euthanasie (T4) memorial's long blue glass wall. */
function buildBlueWall(builder: Builder, x: number, y: number, z: number): void {
  box(builder, DARK_CUBE, x, y + 0.15, z, 26, 0.3, 3.2);
  box(builder, GLASS_BLUE, x, y + 1.6, z, 24, 2.6, 0.35);
}

function buildWhiteCrosses(
  builder: Builder,
  x: number,
  y: number,
  z: number,
): void {
  for (let index = -3; index <= 3; index += 1) {
    const px = x + index * 1.4;
    box(builder, WHITE, px, y + 1.05, z, 0.14, 1.8, 0.14);
    box(builder, WHITE, px, y + 1.45, z, 0.7, 0.14, 0.14);
  }
}

function buildUnityFlag(builder: Builder, x: number, y: number, z: number): void {
  box(builder, STONE, x, y + 0.3, z, 2.2, 0.6, 2.2);
  box(builder, 0x8e9a9e, x, y + 7.1, z, 0.18, 13, 0.18);
  box(builder, 0x1c1c1c, x + 1.3, y + 12.5, z, 2.4, 0.55, 0.1);
  box(builder, 0xb03434, x + 1.3, y + 11.95, z, 2.4, 0.55, 0.1);
  box(builder, 0xd9a92e, x + 1.3, y + 11.4, z, 2.4, 0.55, 0.1);
}

/** Grundgesetz 49: the row of glass panels along the Spree. */
function buildGlassPanels(builder: Builder, x: number, y: number, z: number): void {
  for (let index = -2; index <= 2; index += 1) {
    box(builder, GLASS_BLUE, x + index * 5.4, y + 1.5, z, 4.6, 2.6, 0.3);
  }
}

/**
 * Eberlein's 1903 Carrara marble group under the flat reddish roof that
 * was put over it to keep the weather off the marble. The roof is the
 * thing you recognise the monument by from any distance, so it is drawn
 * as its own element: four slim posts and a low overhanging canopy.
 */
function buildWagnerMemorial(
  builder: Builder,
  x: number,
  y: number,
  z: number,
): void {
  box(builder, STONE_LIGHT, x, y + 0.35, z, 8, 0.7, 6.4);
  box(builder, MARBLE, x, y + 1.5, z, 4.6, 1.6, 3.4);
  // Wagner sits; the allegorical figures crouch around the base.
  box(builder, MARBLE, x, y + 3.1, z - 0.3, 1.7, 1.8, 1.5);
  box(builder, MARBLE, x, y + 4.3, z - 0.3, 1.1, 0.7, 1.1);
  for (const [dx, dz] of [
    [-1.7, 1.2],
    [1.7, 1.2],
  ]) {
    box(builder, MARBLE, x + dx, y + 2.9, z + dz, 1, 1.2, 1);
  }
  for (const dx of [-3.6, 3.6]) {
    for (const dz of [-2.8, 2.8]) {
      box(builder, CANOPY_POST, x + dx, y + 3.4, z + dz, 0.24, 6.1, 0.24);
    }
  }
  // The real 1987/88 Schutzdach (Marianne Wagner, architect) is a steel
  // barrel vault under plexiglass, not a flat gable -- five stepped
  // slabs of shrinking width approximate the half-round cross-section
  // running east-west over the monument, per
  // https://bildhauerei-in-berlin.de/bildwerk/wagnerdenkmal-5372/ and
  // https://de.wikipedia.org/wiki/Richard-Wagner-Denkmal_(Berlin) .
  box(builder, CANOPY_ROOF, x, y + 6.55, z, 9.6, 0.4, 7.8);
  const vaultSteps = [
    { dy: 6.95, sx: 8.6, sy: 0.42, sz: 6.9 },
    { dy: 7.35, sx: 7.2, sy: 0.42, sz: 5.7 },
    { dy: 7.72, sx: 5.6, sy: 0.4, sz: 4.4 },
    { dy: 8.06, sx: 3.8, sy: 0.36, sz: 2.9 },
  ];
  for (const step of vaultSteps) {
    box(builder, CANOPY_ROOF, x, y + step.dy, z, step.sx, step.sy, step.sz);
  }
  box(builder, CANOPY_ROOF, x, y + 8.32, z, 1.6, 0.3, 1.2); // vault ridge cap
}

/**
 * The Luiseninsel figures — Encke's Königin Luise (1880, cylindrical
 * pedestal with a Befreiungskriege relief band, downcast standing
 * queen), Drake's Friedrich Wilhelm III (1849, tall square pedestal,
 * mantled king), and Brütt's Jung-Wilhelm (1904, low pedestal with a
 * tree-stump prop, young Garde-Füsilier officer with sabre and
 * gloves). They used to share one 5-box stack per the v0.57 marble
 * blob; each now gets a shape that matches its real composition, with
 * a head/torso/arm silhouette instead of a single body box, per
 * https://de.wikipedia.org/wiki/Luiseninsel and
 * https://bildhauerei-in-berlin.de/bildwerk/koenigin-luise-denkmal-6298/
 * and https://bildhauerei-in-berlin.de/bildwerk/jung-wilhelm-4679/ .
 * Presentation geometry approximating the documented composition —
 * not a survey model (Vertrag 5).
 */
function buildMarbleFigure(
  builder: Builder,
  x: number,
  y: number,
  z: number,
  variant: "luise" | "friedrich-wilhelm" | "wilhelm" = "luise",
): void {
  if (variant === "friedrich-wilhelm") {
    // Drake's 1849 king: tall square granite-look pedestal, mantled
    // standing figure with a crown-height head — the tallest of the
    // three so he reads across the water from the queen's island.
    box(builder, STONE_LIGHT, x, y + 0.3, z, 4.4, 0.6, 4.4);
    box(builder, MARBLE, x, y + 1.5, z, 3, 2.4, 3);
    box(builder, MARBLE, x, y + 2.85, z, 3.4, 0.3, 3.4);
    box(builder, MARBLE, x, y + 4.55, z, 1.7, 3.1, 1.4); // mantled torso
    box(builder, MARBLE, x, y + 6.35, z, 0.55, 0.55, 0.55); // head
    for (const side of [-1, 1]) {
      box(builder, MARBLE, x + side * 0.95, y + 4.9, z, 0.42, 2.2, 0.42);
    }
    return;
  }
  if (variant === "wilhelm") {
    // Brütt's 1904 Jung-Wilhelm: low two-step pedestal, a tree-stump
    // prop behind the figure, young officer in a peaked Garde cap with
    // a sabre held to his side.
    box(builder, STONE_LIGHT, x, y + 0.22, z, 2.6, 0.44, 2.2);
    box(builder, STONE_LIGHT, x, y + 0.58, z, 2.2, 0.28, 1.9);
    box(builder, MARBLE, x, y + 1.95, z, 1.5, 2.5, 1.3); // pedestal block
    box(builder, MARBLE, x - 0.55, y + 3.8, z - 0.35, 0.42, 2.7, 0.42); // stump
    box(builder, MARBLE, x, y + 4.15, z, 0.85, 2.3, 0.7); // torso
    box(builder, MARBLE, x, y + 5.9, z, 0.42, 0.42, 0.42); // head
    box(builder, MARBLE, x, y + 6.2, z, 0.5, 0.16, 0.5); // peaked cap
    box(builder, MARBLE, x + 0.55, y + 3.9, z + 0.1, 0.2, 1.9, 0.2); // sabre arm
    return;
  }
  // Encke's 1880 Königin Luise: cylindrical relief pedestal (the
  // Befreiungskriege frieze), downcast standing figure in a long gown.
  box(builder, STONE_LIGHT, x, y + 0.25, z, 3.4, 0.5, 3.4);
  box(builder, MARBLE, x, y + 1.25, z, 2.6, 1.6, 2.6); // relief drum
  box(builder, MARBLE, x, y + 2.15, z, 2.9, 0.24, 2.9); // drum cap
  box(builder, MARBLE, x, y + 3.85, z, 1.5, 3.2, 1.1); // gown/torso, tapers up
  box(builder, MARBLE, x, y + 5.6, z, 0.95, 0.6, 0.75); // shoulders
  box(builder, MARBLE, x, y + 6.22, z, 0.44, 0.44, 0.44); // downcast head
  for (const side of [-1, 1]) {
    box(builder, MARBLE, x + side * 0.55, y + 4.25, z + 0.15, 0.28, 1.7, 0.28);
  }
}

function buildLuiseninselFlowerBeds(
  builder: Builder,
  x: number,
  y: number,
  z: number,
): void {
  const colors = [FLOWER_RED, FLOWER_GOLD, FLOWER_WHITE, FLOWER_PINK];
  for (let index = 0; index < 16; index += 1) {
    const angle = (index / 16) * Math.PI * 2;
    const radius = index % 2 === 0 ? 8.2 : 6.3;
    box(
      builder,
      colors[index % colors.length],
      x + Math.cos(angle) * radius,
      y + 0.13,
      z + Math.sin(angle) * radius,
      2.8,
      0.16,
      1.25,
      -angle,
    );
  }
}

/** Moltke and Roon: a bronze general on a tall granite pedestal. */
function buildGeneralColumn(
  builder: Builder,
  x: number,
  y: number,
  z: number,
): void {
  box(builder, STONE_LIGHT, x, y + 0.35, z, 6, 0.7, 6);
  box(builder, GRANITE_RED, x, y + 1.4, z, 3.6, 1.4, 3.6);
  box(builder, GRANITE_RED, x, y + 4.6, z, 2.6, 5, 2.6);
  box(builder, GRANITE_RED, x, y + 7.4, z, 3.2, 0.55, 3.2);
  box(builder, BRONZE, x, y + 9.6, z, 1.5, 3.9, 1.5);
  box(builder, BRONZE, x, y + 11.8, z, 0.8, 0.7, 0.8);
}

/**
 * Louis Tuaillon's "Amazone zu Pferde" (1895), the bronze amazon riding
 * bareback on the Großer Weg: a granite plinth carrying a standing horse
 * — barrel, arched neck, head, tail and four legs — with the upright
 * rider sitting well back the way Tuaillon posed her. Reference:
 * https://de.wikipedia.org/wiki/Amazone_zu_Pferde .
 */
function buildAmazone(
  builder: Builder,
  x: number,
  y: number,
  z: number,
): void {
  // Granite pedestal with a stepped foot.
  box(builder, STONE, x, y + 0.3, z, 4.2, 0.6, 2.2);
  box(builder, GRANITE_RED, x, y + 1.35, z, 3.4, 1.5, 1.7);
  const deck = y + 2.1;
  // Horse: barrel, chest, croup, neck, head, tail, four legs.
  box(builder, BRONZE, x, deck + 1.65, z, 2.6, 0.95, 0.85);
  box(builder, BRONZE, x - 1.35, deck + 1.6, z, 0.6, 0.85, 0.8);
  box(builder, BRONZE, x + 1.3, deck + 1.7, z, 0.55, 0.8, 0.8);
  box(builder, BRONZE, x - 1.62, deck + 2.5, z, 0.5, 1.05, 0.55, 0.35);
  box(builder, BRONZE, x - 1.95, deck + 3.06, z, 0.78, 0.42, 0.42);
  box(builder, BRONZE, x + 1.68, deck + 1.2, z, 0.28, 0.9, 0.3, -0.3);
  for (const [legX, legZ] of [
    [-1.05, -0.28], [-1.05, 0.28], [1.05, -0.28], [1.05, 0.28],
  ] as const) {
    box(builder, BRONZE, x + legX, deck + 0.6, z + legZ, 0.24, 1.2, 0.24);
  }
  // Rider: upright torso seated well back, head, both legs along the flank.
  box(builder, BRONZE, x + 0.35, deck + 2.75, z, 0.5, 1.25, 0.45);
  box(builder, BRONZE, x + 0.35, deck + 3.62, z, 0.34, 0.42, 0.34);
  for (const side of [-1, 1]) {
    box(builder, BRONZE, x + 0.42, deck + 1.85, z + side * 0.5, 0.3, 0.95, 0.24);
  }
}

/**
 * Wilhelm Wolff's "Löwengruppe" (1872) at the Großer Weg: a lioness on a
 * low rock bringing prey to her cubs. Drawn as the flat rock, the large
 * reclining lioness — body, raised head with muzzle, forepaws — and two
 * small cubs pressed against her flank. Reference:
 * https://de.wikipedia.org/wiki/L%C3%B6wengruppe_(Berlin) .
 */
function buildLionGroup(
  builder: Builder,
  x: number,
  y: number,
  z: number,
): void {
  // Low natural-rock base, two overlapping slabs.
  box(builder, STONE, x, y + 0.35, z, 4.6, 0.7, 2.8);
  box(builder, STONE_LIGHT, x - 0.3, y + 0.85, z + 0.1, 3.4, 0.35, 2.1, 0.12);
  const deck = y + 1.0;
  // Lioness: long reclining body, chest rising to the alert head.
  box(builder, BRONZE, x - 0.2, deck + 0.55, z - 0.3, 2.9, 0.85, 1.05);
  box(builder, BRONZE, x - 1.35, deck + 1.05, z - 0.3, 0.85, 1.0, 0.95);
  box(builder, BRONZE, x - 1.55, deck + 1.85, z - 0.3, 0.62, 0.6, 0.58, 0.2);
  box(builder, BRONZE, x - 1.92, deck + 1.7, z - 0.3, 0.45, 0.32, 0.4);
  // Forepaws stretched ahead of the chest, tail along the rock.
  for (const side of [-1, 1]) {
    box(builder, BRONZE, x - 1.7, deck + 0.25, z - 0.3 + side * 0.32, 0.85, 0.4, 0.26);
  }
  box(builder, BRONZE, x + 1.45, deck + 0.3, z - 0.15, 0.9, 0.22, 0.22, -0.4);
  // Two cubs against the flank.
  box(builder, BRONZE, x + 0.35, deck + 0.32, z + 0.75, 1.05, 0.5, 0.5, 0.15);
  box(builder, BRONZE, x - 0.75, deck + 0.3, z + 0.8, 0.9, 0.45, 0.45, -0.2);
}

/** The white marble on the Luiseninsel's formal garden. */

const LUISENINSEL_NAMES = /Königin Luise|Wilhelm( I+\.)? von Preußen/i;

const STATUE_NAMES =
  /Lessing|Grimm|Bruno|Rufer|Lortzing|Moore|Reichstagsabgeordneten/i;

// Memorials the verified recognition layer (MemorialLandmarks) already
// models completely — the Holocaust stelae field, the Soviet memorial
// with its T-34s and soldier, Sinti-und-Roma, the Homosexuellen cuboid,
// Goethe and the composers. Drawing them twice doubles the geometry.
// Bismarck is here too: createSiegessaeule() in IsometricCityWorld.ts
// already draws the Bismarck-Nationaldenkmal as part of its verified
// Großer Stern recognition model (fixed offset from the Siegessäule,
// matching the real 1938/39 relocation next to the column) — v0.58.0
// found this OSM "Otto von Bismarck" artwork point was drawing a
// *second*, independently-positioned Bismarck about 58 m away from
// the recognition model's placement, i.e. two chancellors at the same
// intersection. Skipping it here removes the duplicate; the detailed
// figure now lives solely in createSiegessaeule().
export const MONUMENTS_ALREADY_MODELLED =
  /ermordeten Juden Europas|Sowjetisches Ehrenmal|Sowjetischer Soldat|Sinti und Roma|Homosexuellen|Beethoven-Haydn-Mozart|Goethe|Zeugen Jehovas|^Otto von Bismarck$|^Quadriga mit Victoria$/i;

export function createTiergartenMonuments(
  street: StreetDetailsPayload,
  ground: VoxelPayload,
): Group | null {
  if (!street.monuments || street.monuments.length === 0) {
    return null;
  }
  const sample = worldGroundSampler(ground);
  const builder: Builder = { edges: [], parts: [] };
  for (const entry of street.monuments) {
    const x = entry.x_dm / 10;
    const z = entry.z_dm / 10;
    const y = sample(x, z);
    if (y === null) {
      continue;
    }
    const name = entry.name;
    if (MONUMENTS_ALREADY_MODELLED.test(name) || entry.kind === "tank") {
      // The verified recognition layer carries these (incl. both T-34s).
    } else if (entry.kind === "cannon") {
      buildCannon(builder, x, y, z);
    } else if (/Verkehrsturm/i.test(name)) {
      buildVerkehrsturm(builder, x, y, z);
    } else if (/Euthanasie|Aktion T4/i.test(name)) {
      buildBlueWall(builder, x, y, z);
    } else if (/Weiße Kreuze/i.test(name)) {
      buildWhiteCrosses(builder, x, y, z);
    } else if (/Fahne der Einheit/i.test(name)) {
      buildUnityFlag(builder, x, y, z);
    } else if (/Grundgesetz/i.test(name)) {
      buildGlassPanels(builder, x, y, z);
    } else if (/^Robert Koch$/i.test(name)) {
      buildRobertKochMemorial(builder, x, y, z);
    } else if (/Richard Wagner|Wagner-Denkmal/i.test(name)) {
      buildWagnerMemorial(builder, x, y, z);
    } else if (/Moltke|Roon/i.test(name)) {
      buildGeneralColumn(builder, x, y, z);
    } else if (LUISENINSEL_NAMES.test(name)) {
      const variant = /Friedrich Wilhelm/i.test(name)
        ? "friedrich-wilhelm"
        : /Königin Luise/i.test(name)
          ? "luise"
          : "wilhelm";
      buildMarbleFigure(builder, x, y, z, variant);
      if (variant === "luise") {
        buildLuiseninselFlowerBeds(builder, x, y, z);
      }
    } else if (/^Lessing-Denkmal$|Gotthold Ephraim Lessing/i.test(name)) {
      buildLessingMemorial(builder, x, y, z);
    } else if (/Amazone zu Pferde/i.test(name)) {
      buildAmazone(builder, x, y, z);
    } else if (/Löwengruppe/i.test(name)) {
      buildLionGroup(builder, x, y, z);
    } else if (entry.kind === "artwork") {
      // Every named artwork has its own builder hook. Quiet OSM memorial
      // markers alone may use the small `buildStone` fallback below.
      ARTWORK_BUILDERS[name]?.(builder, x, y, z);
    } else if (STATUE_NAMES.test(name)) {
      buildStatue(builder, x, y, z);
    } else {
      buildStone(builder, x, y, z);
    }
  }
  if (builder.parts.length === 0) {
    return null;
  }
  const group = new Group();
  group.name = "OSM Tiergarten monuments";
  // Vertrag 5: every figure in this file is referenced-based presentation
  // geometry built from OSM point positions plus Wikipedia/Wikimedia
  // photographs and Landesdenkmalamt/bildhauerei-in-berlin.de
  // descriptions, not a survey or photogrammetry model. Individual
  // monuments merge into one mesh for draw-call economy, so the label
  // lives on the whole group rather than per-figure.
  group.userData.geometryStatus =
    "Reference-based presentation geometry from OSM point positions and " +
    "Wikipedia/Wikimedia/Denkmaldatenbank descriptions - not a survey model";
  group.userData.luiseninselFormalGarden =
    "Reference-based Schmuckbeete around the OSM-positioned Koenigin Luise figure";
  group.userData.sourceUrls = [
    "https://www.berlin.de/ba-mitte/ueber-den-bezirk/sehenswertes/denkmaeler/denkmaeler-suchen/index.php/detail/216",
  ];

  const merged = mergeGeometries(builder.parts, false);
  if (merged) {
    const dayMaterial = new MeshBasicMaterial({ vertexColors: true });
    const nightMaterial = new MeshStandardMaterial({
      flatShading: true,
      metalness: 0,
      roughness: 0.9,
      vertexColors: true,
    });
    const mesh = new Mesh(merged, dayMaterial);
    mesh.name = "monument bodies";
    mesh.userData.nightMaterial = nightMaterial;
    mesh.userData.dayMaterial = dayMaterial;
    group.add(mesh);
    for (const part of builder.parts) {
      part.dispose();
    }
  }
  const inkGeometry = mergeGeometries(builder.edges, false);
  if (inkGeometry) {
    const ink = new LineSegments(
      inkGeometry,
      new LineBasicMaterial({ color: MONUMENT_INK }),
    );
    ink.name = "monument ink lines";
    ink.renderOrder = 2;
    group.add(ink);
    for (const edge of builder.edges) {
      edge.dispose();
    }
  }

  return group;
}
