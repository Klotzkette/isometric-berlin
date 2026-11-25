import { stelenfeldRimGroundAtV385 } from "./stelenfeldRimV385";
import survey from "./data/stelenfeldV385/field.json";
import { decodeBase64Bytes } from "./decodeBase64Bytes";
import { inStelenfeldSite, STELENFELD_ANCHOR, STELENFELD_BASE } from "./stelenfeldSiteV385";

export { HOLOCAUST_MINECRAFT_PROTECTION, isHolocaustMinecraftProtectedAt } from "./stelenfeldSiteV385";
export const HOLOCAUST_FIELD = {
  steleWidth: 0.95, steleLength: 2.38, alley: 0.95, steleCount: 2710,
  minHeight: 0, maxHeight: 4.7, maxTiltDegrees: 2,
} as const;
export const PITCH_ACROSS = HOLOCAUST_FIELD.steleWidth + HOLOCAUST_FIELD.alley;
export const PITCH_ALONG = HOLOCAUST_FIELD.steleLength + HOLOCAUST_FIELD.alley;
export const HOLOCAUST_GEOMETRY_STATUS =
  "2710 concrete stelae including 112 flush with the paving. Registered ALKIS, OSM and orthophoto positions; ALS-derived lane and top heights. Four raised tops under trees, sub-canopy flush positions and individual inclinations are estimates.";

export type StelePlacement = {
  x: number; z: number; ground: number; height: number; rotationY: number;
  tiltX: number; tiltZ: number;
};

const int16 = (b64: string) => new Int16Array(decodeBase64Bytes(b64).buffer);
let heights: Int16Array | undefined;
const [minX,minZ,pitch,cols,rows] = survey.grid;

/** Interpolate the same two plane triangles as the survey pavement at each cell. */
export function stelenfeldFloorSampleV385(x: number, z: number): number {
  heights ??= int16(survey.floor);
  const gx = Math.max(0, Math.min(cols-1, (x-minX)/pitch));
  const gz = Math.max(0, Math.min(rows-1, (z-minZ)/pitch));
  const i = Math.min(cols-2, Math.floor(gx)), j = Math.min(rows-2, Math.floor(gz));
  const u = gx-i, v = gz-j, k = j*cols+i;
  const a = heights[k], b = heights[k+1], c = heights[k+cols+1], d = heights[k+cols];
  return (u>=v ? a+(b-a)*u+(c-b)*v : a+(d-a)*v+(c-d)*u)/100;
}

export function stelenfeldGroundAtV385(x: number, z: number, native=false): number | null {
  return inStelenfeldSite(x,z) ? stelenfeldFloorSampleV385(x,z) : stelenfeldRimGroundAtV385(x,z,native);
}

let placements: StelePlacement[] | undefined;
export function holocaustStelePlacements(): StelePlacement[] {
  if (placements) return placements;
  placements = [];
  const raw = int16(survey.stelae);
  for (let i=0; i<raw.length; i+=6) {
    const x = 460+raw[i]/100, z = 550+raw[i+1]/100;
    const slopeX = raw[i+4]/1000, slopeZ = raw[i+5]/1000;
    // A flush slab follows the paved slope. Internal 4 m cell boundaries can
    // change gradient, so use the neighbourhood spanning half a stele.
    const raised = raw[i+2] !== 0;
    const dx = raised ? slopeX : (stelenfeldFloorSampleV385(x+.8,z)-stelenfeldFloorSampleV385(x-.8,z))/1.6;
    const dz = raised ? slopeZ : stelenfeldFloorSampleV385(x,z+.5)-stelenfeldFloorSampleV385(x,z-.5);
    const cap = raised ? Math.min(1, Math.tan(Math.PI/90)/(Math.hypot(dx,dz)||1)) : 1;
    placements.push({
      x: x-STELENFELD_ANCHOR[0], z: z-STELENFELD_ANCHOR[1],
      ground: stelenfeldFloorSampleV385(x,z)-STELENFELD_BASE, height: raw[i+2]/100,
      rotationY: -raw[i+3]/1000, tiltX: -Math.atan(dz*cap), tiltZ: Math.atan(dx*cap),
    });
  }
  return placements;
}

export function stelenfeldPavementDataV385() {
  const raw = int16(survey.positions);
  const positions = new Float32Array(raw.length);
  for (let i=0; i<raw.length; i+=3) {
    positions[i] = 460+raw[i]/100-STELENFELD_ANCHOR[0];
    positions[i+1] = raw[i+1]/100-STELENFELD_BASE;
    positions[i+2] = 550+raw[i+2]/100-STELENFELD_ANCHOR[1];
  }
  return {positions, indices: new Uint16Array(decodeBase64Bytes(survey.indices).buffer)};
}

export const stelenfeldTreesV385 = survey.trees;
export const stelenfeldInformationBuildingV385 = survey.entrance;

let collision: Map<number, StelePlacement[]> | undefined;
export function stelenfeldSolidAtV385(x: number, y: number, z: number, radius=0): boolean {
  if (x<389 || x>568 || z<482 || z>649) return false;
  if (x>=546.7-radius && x<=553.85+radius && z>=581.91-radius && z<=589.06+radius &&
      y>=3.6 && y<=survey.entrance.roofCm/100) {
    const px=(x-460)*100, pz=(z-550)*100;
    let inside=false;
    const ring=survey.entrance.ring;
    for (let i=0;i<ring.length;i++) {
      const [ax,az]=ring[i], [bx,bz]=ring[(i+1)%ring.length];
      const dx=bx-ax,dz=bz-az;
      if ((az>pz)!==(bz>pz) && px < ax+dx*(pz-az)/dz) inside=!inside;
      if (radius>0) {
        const t=Math.max(0,Math.min(1,((px-ax)*dx+(pz-az)*dz)/(dx*dx+dz*dz)));
        if ((px-ax-t*dx)**2+(pz-az-t*dz)**2 <= (radius*100)**2) return true;
      }
    }
    if (inside) return true;
  }
  if (!collision) {
    collision = new Map();
    for (const stele of holocaustStelePlacements()) {
      if (stele.height <= 0.04) continue;
      const key = Math.floor((stele.x+STELENFELD_ANCHOR[0])/4)*256+
        Math.floor((stele.z+STELENFELD_ANCHOR[1])/4);
      const bucket = collision.get(key);
      if (bucket) bucket.push(stele);
      else collision.set(key,[stele]);
    }
  }
  const ix = Math.floor(x/4), iz = Math.floor(z/4);
  for (let i=ix-1; i<=ix+1; i++) for (let j=iz-1; j<=iz+1; j++) {
    const stones = collision.get(i*256+j);
    if (!stones) continue;
    for (const s of stones) {
      const h = y-STELENFELD_BASE-s.ground;
      if (h < -0.04 || h>s.height+0.025) continue;
      const dx = x-STELENFELD_ANCHOR[0]-s.x+(h-s.height/2)*Math.tan(s.tiltZ);
      const dz = z-STELENFELD_ANCHOR[1]-s.z-(h-s.height/2)*Math.tan(s.tiltX);
      const c = Math.cos(s.rotationY), t = Math.sin(s.rotationY);
      const outsideX = Math.max(0, Math.abs(c*dx-t*dz)-HOLOCAUST_FIELD.steleLength/2);
      const outsideZ = Math.max(0, Math.abs(t*dx+c*dz)-HOLOCAUST_FIELD.steleWidth/2);
      if (outsideX*outsideX+outsideZ*outsideZ <= radius*radius) return true;
    }
  }
  return false;
}
