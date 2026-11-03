import data from "./data/northParkTerrainV306.json";
type Domain={type:string;coordinates:number[][][]|number[][][][]};
function inRing(x:number,z:number,ring:readonly number[][]):boolean{let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
function inDomain(x:number,z:number,value:Domain):boolean{const polygons=value.type==="Polygon"?[value.coordinates as number[][][]]:value.coordinates as number[][][][];return polygons.some(p=>inRing(x,z,p[0])&&!p.slice(1).some(h=>inRing(x,z,h)));}
/** A delta to the complete unchanged v182 field, not a second additive hill.
 * Four-metre native columns use their own horizontal cell-centre ordinate. */
export function northParkTerrainOffsetV306(x:number,z:number,native=false):number{
 if(native){x=Math.floor(x/4)*4+2;z=Math.floor(z/4)*4+2;}
 for(const p of data.profiles){const[w,n,e,s]=p.bounds;if(x<=w||x>=e||z<=n||z>=s)continue;const u=(x-w)/p.step,v=(z-n)/p.step,i=Math.floor(u),j=Math.floor(v),a=u-i,b=v-j;const nw=p.offsets[j][i],ne=p.offsets[j][i+1],sw=p.offsets[j+1][i],se=p.offsets[j+1][i+1];if(nw===0&&ne===0&&sw===0&&se===0)return 0;if(!inDomain(x,z,p.domain as unknown as Domain))return 0;return a>=b?nw*(1-a)+ne*(a-b)+se*b:nw*(1-b)+sw*(b-a)+se*a;}return 0;
}
export const NORTH_PARK_TERRAIN_V306_BOUNDS=data.profiles.map(p=>p.bounds as readonly number[]);
/** Identify only an actually represented measured domain, including its holes. */
export function northParkTerrainFieldAtV306(x:number,z:number,native=false):string|null{
 if(native){x=Math.floor(x/4)*4+2;z=Math.floor(z/4)*4+2;}
 for(const p of data.profiles){const[w,n,e,s]=p.bounds;if(x>w&&x<e&&z>n&&z<s&&inDomain(x,z,p.domain as unknown as Domain))return p.key;}return null;
}
