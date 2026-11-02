import data from './data/wallGalleryV298.json';
export type WallPointV298=readonly[number,number];
export const WALL_GALLERY_V298_DATA=data;
export const WALL_GALLERY_HILL_MASK_V298=data.hill.mask;
const hillRing=data.hill.mask.coordinates[0];
/** Exact bounds of the finite display support; not a surveyed hill parcel. */
export const WALL_GALLERY_HILL_BOUNDS_V298=[Math.min(...hillRing.map(p=>p[0])),Math.min(...hillRing.map(p=>p[1])),Math.max(...hillRing.map(p=>p[0])),Math.max(...hillRing.map(p=>p[1]))];
export const WALL_GALLERY_V298_PROFILE={step:10,textureFree:true,fullStaticDetailOnTouch:true,independentOrthogonalNative:true,retainedSourceRings:true,newTourStops:0,sourceReceipt:'wall-gallery-v298-evidence.json.gz',muralPolicy:'Eight independently authored flat-colour vector interpretations of named works at retained OSM artwork anchors. No photograph, sampled pixel, texture or claim of digital facsimile/photo realism.',estimatePolicy:'General3.6m Grenzmauer75 height; panel pitch, coping, weathering, mural widths/fine colour fields and facade subdivisions are display estimates. All seven current source footprints and real gaps are retained. DGM samples are metric; boundary interpolation and seam are explicit display fits.'} as const;
export function wallPointInRingV298(r:readonly(readonly number[])[],x:number,z:number):boolean{let yes=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
function distanceToSegment(x:number,z:number,a:readonly number[],b:readonly number[]):number{const dx=b[0]-a[0],dz=b[1]-a[1],l=dx*dx+dz*dz,t=l?Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/l)):0;return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);}
function distanceToRing(r:readonly(readonly number[])[],x:number,z:number):number{let d=Infinity;for(let i=1;i<r.length;i++)d=Math.min(d,distanceToSegment(x,z,r[i-1],r[i]));return d;}
/** Raw bilinear interpolation of unchanged DGM raster-centre elevations. The
 * interpolation is not a claim that points between the samples were measured. */
export function wallGalleryDgmGroundAtV298(x:number,z:number):number|null{
 const g=data.hill,u=(x-g.origin[0])/g.stepM,v=(z-g.origin[1])/g.stepM;
 if(u<0||v<0||u>g.heights[0].length-1||v>g.heights.length-1)return null;
 const i=Math.min(g.heights[0].length-2,Math.floor(u)),j=Math.min(g.heights.length-2,Math.floor(v)),tx=u-i,tz=v-j;
 return(g.heights[j][i]*(1-tx)+g.heights[j][i+1]*tx)*(1-tz)+(g.heights[j+1][i]*(1-tx)+g.heights[j+1][i+1]*tx)*tz;
}
/** Exact finite support; zero delta everywhere outside. The source
 * crest and176m surrounding allowance keep the wall at measured hill height. Only
 * the edge transition to the older flat terrain is a display seam. */
export function wallGalleryHillWeightV298(x:number,z:number):number {
 const g=data.hill,ring=g.mask.coordinates[0];if(!wallPointInRingV298(ring,x,z))return 0;
 const t=Math.min(1,distanceToRing(ring,x,z)/g.seamWidthM);return t*t*(3-2*t);
}
/** Source-height blend before presentation triangulation. Outside is baseline. */
function blendedHillGround(x:number,z:number,baseline:number):number {
 if(!wallGalleryHillContainsV298(x,z))return baseline;
 const raw=wallGalleryDgmGroundAtV298(x,z);if(raw===null)return baseline;
 return baseline+(raw-baseline)*wallGalleryHillWeightV298(x,z);
}
/** Drawn uses the packet splitter's four-metre NW/SE triangles, anchored at
 * the support bounds. Native samples independent global four-metre cell tops.
 * Raw DGM raster samples remain available through wallGalleryDgmGroundAtV298. */
export function wallGalleryHillGroundAtV298(x:number,z:number,native=false,baseline=data.hill.oldGroundY):number|null {
 if(native){x=Math.floor(x/4)*4+2;z=Math.floor(z/4)*4+2;}
 if(!wallGalleryHillContainsV298(x,z))return null;
 if(native)return Math.ceil(blendedHillGround(x,z,baseline)/.125)*.125;
 const step=data.hill.stepM,u=(x-WALL_GALLERY_HILL_BOUNDS_V298[0])/step,v=(z-WALL_GALLERY_HILL_BOUNDS_V298[1])/step;
 const ix=Math.floor(u),iz=Math.floor(v),a=u-ix,b=v-iz;
 const west=WALL_GALLERY_HILL_BOUNDS_V298[0]+ix*step,north=WALL_GALLERY_HILL_BOUNDS_V298[1]+iz*step;
 const nw=blendedHillGround(west,north,baseline),se=blendedHillGround(west+step,north+step,baseline);
 return a>=b?nw*(1-a)+blendedHillGround(west+step,north,baseline)*(a-b)+se*b:
  nw*(1-b)+blendedHillGround(west,north+step,baseline)*(b-a)+se*a;
}
export function wallGalleryHillDeltaV298(x:number,z:number,native=false,baseline=data.hill.oldGroundY):number{return(wallGalleryHillGroundAtV298(x,z,native,baseline)??baseline)-baseline;}
export function wallGalleryHillContainsV298(x:number,z:number):boolean{return wallPointInRingV298(data.hill.mask.coordinates[0],x,z);}
export function wallGalleryHistoricSolidAtV298(x:number,y:number,z:number,radius=0,native=false):boolean {
 if(x>4000&&x<5100&&z>1100&&z<2100&&y>=3.0&&y<6.6)return data.walls.some(w=>wallPointInRingV298(w.ring,x,z)||radius>0&&distanceToRing(w.ring,x,z)<=radius+(native?.45:0));
 if(x>2180&&x<2340&&z>-2730&&z<-2460){const h=wallGalleryHillGroundAtV298(x,z,native);if(h===null||y<h||y>=h+3.0)return false;const r=data.parkWall.geometry.coordinates;for(let i=1;i<r.length;i++)if(distanceToSegment(x,z,r[i-1],r[i])<=radius+(native?.4:.14))return true;}
 return false;
}
