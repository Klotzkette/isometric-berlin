import source from "./alexanderPublicRealmSource.json";

export const ALEXANDER_PUBLIC_REALM_SOURCE = source;
const ground = source.ground_y_m;
export const ALEXANDER_PUBLIC_REALM_PROFILE = Object.freeze({
  marxEngels: { osmKey: source.marx_engels.osm_key,
    position: [source.marx_engels.center_xz[0], ground, source.marx_engels.center_xz[1]] as const,
    // East-northeast, toward Fernsehturm; orthogonal to the measured base.
    frontAngleRad: -.636, heightM: 3.95, artist: "Ludwig Engelhardt" },
  neptun: { osmKey: source.neptun.osm_key,
    position: [source.neptun.center_xz[0], ground, source.neptun.center_xz[1]] as const,
    heightM: 10, publishedBasinDiameterM: 18, artist: "Reinhold Begas" },
  treeCount: source.added_trees.length,
  retainedForumTreeCount: source.retained_existing_tree_count_in_forum,
  dimensionsPolicy: "OSM anchors/outlines; anatomy and intermediate proportions are procedural recognition estimates",
  currentLayout: source.current_layout_note,
});
export const ALEXANDER_PUBLIC_REALM_OSM_KEYS = Object.freeze([
  source.marx_engels.osm_key, source.ensemble.osm_key, source.neptun.osm_key,
  source.alte_welt.osm_key, ...source.secondary.map(s => s.osm_key),
]);
/** The new trees are already offline-deduplicated: suppress no old tree. */
export const ALEXANDER_PUBLIC_REALM_TREE_EXCLUSIONS: readonly string[] = Object.freeze([]);
export const ALEXANDER_PUBLIC_REALM_PROTECTION = Object.freeze([
  { osmKey: source.ensemble.osm_key, x: source.ensemble.center_xz[0], z: source.ensemble.center_xz[1], radius: 48 },
  { osmKey: source.neptun.osm_key, x: source.neptun.center_xz[0], z: source.neptun.center_xz[1], radius: 10 },
]);
type Solid = { x: number; z: number; radius: number; base: number; top: number; id: string };
/** Only actual plinths/sculpture bodies and tree trunks; no enclosing park/circle collider. */
export const ALEXANDER_PUBLIC_REALM_SOLIDS: readonly Solid[] = Object.freeze([
  ...[[-.82,-.23,3.95,.76],[.91,.25,3.16,.86]].map(([side,front,h,r])=>({id:`marx-engels-${side}`,
    x:source.marx_engels.center_xz[0]+Math.cos(-.636)*front-Math.sin(-.636)*side,
    z:source.marx_engels.center_xz[1]+Math.sin(-.636)*front+Math.cos(-.636)*side,
    radius:r,base:ground+.18,top:ground+h})),
  { id: "neptun-centre", x: source.neptun.center_xz[0], z: source.neptun.center_xz[1], radius: 2.7, base: ground, top: ground + 8.55 },
  ...source.added_trees.map(t => ({ id: t.osm_key, x: t.position[0], z: t.position[2], radius: .22, base: t.position[1], top: t.position[1] + t.height_m * .68 })),
  ...source.secondary.map(s => ({ id: s.osm_key, x: s.center_xz[0], z: s.center_xz[1], radius: s.kind === "double-stele" ? .66 : 1.45, base: ground, top: ground + (s.kind === "double-stele" ? 4 : 2) })),
]);
function nearby(x:number,z:number):boolean {return x>=2110&&x<=2420&&z>=-50&&z<=245;}
function segmentDistance(x:number,z:number,a:number[],b:number[]):number {
  const dx=b[0]-a[0],dz=b[1]-a[1],len=dx*dx+dz*dz;
  const t=len?Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/len)):0;
  return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz);
}
function inside(x:number,z:number,ring:number[][],radius=0):boolean {
  let result=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
    const a=ring[i],b=ring[j];
    if(radius>0&&segmentDistance(x,z,a,b)<=radius)return true;
    if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])result=!result;
  }
  return result;
}
function rimAt(x:number,z:number,radius=0):boolean {
  if(Math.hypot(x-source.neptun.center_xz[0],z-source.neptun.center_xz[1])>10+radius)return false;
  const ring=source.neptun.outline_xz;
  return ring.some((p,i)=>i>0&&segmentDistance(x,z,ring[i-1],p)<.32+radius);
}
export function alexanderPublicRealmSolidAt(x: number, z: number, y: number, radius = 0): boolean {
  if(!nearby(x,z)||y<ground||y>ground+15)return false;
  if(y<ground+.18-.001&&inside(x,z,source.marx_engels.outline_xz,radius))return true;
  if(y<ground+.7-.001&&rimAt(x,z,radius))return true;
  if(y<ground+3.2-.001&&inside(x,z,source.alte_welt.outline_xz,radius))return true;
  return ALEXANDER_PUBLIC_REALM_SOLIDS.some(s => y >= s.base && y < s.top-.001 && Math.hypot(x - s.x, z - s.z) < s.radius + radius);
}
export function alexanderPublicRealmSupportHeightAt(x: number, z: number, currentY: number, maxStep = .4): number | null {
  if(!nearby(x,z))return null;
  let best: number | null = ground+.04<=currentY+maxStep&&inside(x,z,source.ensemble.outline_xz)?ground+.04:null;
  // Capsule support extends by the walking body radius (0.42 m) until its trailing foot clears the step.
  if(ground+.18<=currentY+maxStep&&inside(x,z,source.marx_engels.outline_xz,.42))best=ground+.18;
  if(ground+.7<=currentY+maxStep&&rimAt(x,z,.42))best=ground+.7;
  if(ground+3.2<=currentY+maxStep&&inside(x,z,source.alte_welt.outline_xz,.42))best=ground+3.2;
  for (const s of ALEXANDER_PUBLIC_REALM_SOLIDS) if (Math.hypot(x - s.x, z - s.z) < s.radius && s.top <= currentY + maxStep && (best === null || s.top > best)) best = s.top;
  return best;
}
