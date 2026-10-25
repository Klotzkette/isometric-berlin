import data from './data/schlesischesTorV267.json';

export type SchlesischesTorRowV267={position:[number,number,number];size:[number,number,number];angle:number;tone:number;role:string};
export const SCHLESISCHES_TOR_V267_PROFILE={owner:data.owner,groundY:data.groundY,baseTopY:data.baseTopY,fullMobileIdentical:true,retiredOwners:[],dimensionPolicy:data.estimates,
  cameras:{portal:{position:[4740,27,2150],target:[4716,10,2120]},roof:{position:[4780,78,2200],target:[4706,12,2116]},portalClose:{position:[4725,19,2140],target:[4716,10,2120]}}};
export function schlesischesTorContainsV267(ring:readonly (readonly number[])[],x:number,z:number):boolean{
  let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i],b=ring[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }return inside;
}
export function schlesischesTorPointV267(u:number,y:number,v:number):[number,number,number]{
  const [dx,dz]=data.direction;return[data.centre[0]+dx*u-dz*v,y,data.centre[1]+dz*u+dx*v];
}
function hipHeight(roof:typeof data.roofs[number],x:number,z:number):number|null{
  if(!schlesischesTorContainsV267(roof.ring,x,z))return null;
  const [dx,dz]=data.direction,u=(x-data.centre[0])*dx+(z-data.centre[1])*dz-roof.u,v=-(x-data.centre[0])*dz+(z-data.centre[1])*dx-roof.v;
  return data.baseTopY+.03+Math.max(0,Math.min(roof.width/2-Math.abs(v),roof.length/2-Math.abs(u)))/(roof.width/2)*roof.rise;
}
function towerHeight(x:number,z:number):number|null{
  const r=Math.hypot(x-data.tower.centre[0],z-data.tower.centre[1]),profile=data.tower.profile;
  let top:number|null=null;
  for(let i=1;i<profile.length;i++){
    const [a,ra]=profile[i-1],[b,rb]=profile[i];
    if(r>=Math.min(ra,rb)&&r<=Math.max(ra,rb))top=Math.max(top??0,data.baseTopY+a+(b-a)*(r-ra)/(rb-ra));
  }
  if(r<=profile.at(-1)![1])return data.baseTopY+profile.at(-1)![0];
  return top;
}
export function schlesischesTorRoofAtV267(x:number,z:number):number|null{
  if(!schlesischesTorContainsV267(data.ring,x,z))return null;
  const values=[...data.roofs.map(r=>hipHeight(r,x,z)),towerHeight(x,z)].filter((v):v is number=>v!==null);
  return values.length?Math.max(...values):null;
}
export function schlesischesTorRoofCellsV267():SchlesischesTorRowV267[]{
  const rows:SchlesischesTorRowV267[]=[],cell=.6;
  for(let ix=Math.floor(4687/cell);ix<=Math.ceil(4732/cell);ix++)for(let iz=Math.floor(2094/cell);iz<=Math.ceil(2134/cell);iz++){
    const x=(ix+.5)*cell,z=(iz+.5)*cell,y=schlesischesTorRoofAtV267(x,z);if(y===null)continue;
    const top=Math.ceil(y/.2)*.2,bottom=data.nativeBaseTopY-.02;
    rows.push({position:[x,(top+bottom)/2,z],size:[cell,top-bottom,cell],angle:0,tone:0xb56343,role:'native-hipped-and-tower-roof'});
  }return rows;
}
export function schlesischesTorStructuralRowsV267(native=false, includeDecks=true):SchlesischesTorRowV267[]{
  const rows:SchlesischesTorRowV267[]=[];
  const box=(x:number,y:number,z:number,w:number,h:number,d:number,tone:number,role:string,dx=1,dz=0)=>{
    const nx=native?Math.max(1,Math.ceil(w/.6)):1,nz=native?Math.max(1,Math.ceil(d/.6)):1;
    for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){
      const a=(i+.5)*w/nx-w/2,b=(j+.5)*d/nz-d/2;
      rows.push({position:[x+dx*a-dz*b,y,z+dz*a+dx*b],size:native?[Math.abs(dx)*w/nx+Math.abs(dz)*d/nz,h,Math.abs(dz)*w/nx+Math.abs(dx)*d/nz]:[w,h,d],angle:native?0:-Math.atan2(dz,dx),tone,role});
    }
  };
  for(const track of data.tracks){
    const points=track.points;let walked=0,nextSupport=8;
    for(let i=1;i<points.length;i++){
      const [x,z]=points[i-1],dx0=points[i][0]-x,dz0=points[i][1]-z,length=Math.hypot(dx0,dz0),dx=dx0/length,dz=dz0/length;
      if(includeDecks)box(x+dx*length/2,8.72,z+dz*length/2,length,.42,3.1,0x596d61,'mapped-west-viaduct-deck',dx,dz);
      while(nextSupport<=walked+length){
        const u=nextSupport-walked;
        box(x+dx*u,5.75,z+dz*u,.32,5.5,.32,0x50665a,'west-viaduct-slender-support');
        box(x+dx*u,8.25,z+dz*u,.65,.5,2.8,0x50665a,'west-viaduct-support-cap',dx,dz);
        nextSupport+=18;
      }
      walked+=length;
    }
  }
  // Retained source plan already contains the west stair tower; only its
  // photograph-recognizable upper brick shaft is new above the flat cap.
  const p=schlesischesTorPointV267(-17,16.4,9.1),[dx,dz]=data.direction;
  box(...p,4.4,5.4,1.1,0xa75d47,'tower-upper-brick-shaft',dx,dz);
  return rows;
}
export type SchlesischesTorSolidV267={ring:number[][];holes:number[][][];minY:number;maxY:number;sourceId:string;topAt:(x:number,z:number)=>number};
const rowSolid=(r:SchlesischesTorRowV267):SchlesischesTorSolidV267=>{
  const [x,y,z]=r.position,[w,h,d]=r.size,c=Math.cos(r.angle),s=Math.sin(r.angle);
  return{ring:[[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]].map(([u,v])=>[x+c*u+s*v,z-s*u+c*v]),holes:[],minY:y-h/2,maxY:y+h/2,sourceId:'schlesisches-tor-v267-'+r.role,topAt:()=>y+h/2};
};
/** Exact union of the renderer's rotated local deck cells after AABB conversion.
 * Only neighbouring cell indices can overlap the queried location. No cell array
 * is allocated for navigation and no continuous rotated rectangle fills its fringe. */
function nativeDeckSolid(row:SchlesischesTorRowV267):SchlesischesTorSolidV267{
  const [x,y,z]=row.position,[w,h,d]=row.size,dx=Math.cos(row.angle),dz=-Math.sin(row.angle);
  const nx=Math.ceil(w/.6),nz=Math.ceil(d/.6),sw=w/nx,sd=d/nz;
  const halfX=(Math.abs(dx)*sw+Math.abs(dz)*sd)/2,halfZ=(Math.abs(dz)*sw+Math.abs(dx)*sd)/2;
  const boundX=(Math.abs(dx)*w+Math.abs(dz)*d)/2,boundZ=(Math.abs(dz)*w+Math.abs(dx)*d)/2;
  return{ring:[[x-boundX,z-boundZ],[x+boundX,z-boundZ],[x+boundX,z+boundZ],[x-boundX,z+boundZ]],holes:[],minY:y-h/2,maxY:y+h/2,sourceId:'schlesisches-tor-v267-native-deck',topAt:(px,pz)=>{
    const u=(px-x)*dx+(pz-z)*dz,v=-(px-x)*dz+(pz-z)*dx;
    const ci=Math.floor((u+w/2)/sw),cj=Math.floor((v+d/2)/sd);
    for(let i=Math.max(0,ci-1);i<=Math.min(nx-1,ci+1);i++)for(let j=Math.max(0,cj-1);j<=Math.min(nz-1,cj+1);j++){
      const a=(i+.5)*sw-w/2,b=(j+.5)*sd-d/2;
      if(Math.abs(px-(x+dx*a-dz*b))<=halfX+1e-8&&Math.abs(pz-(z+dz*a+dx*b))<=halfZ+1e-8)return y+h/2;
    }
    return Number.NEGATIVE_INFINITY;
  }};
}
/** Lightweight upper envelopes: retained source walls/cap still own the closed
 * station below Y13.71; roofs do not promise a newly opened interior. */
export function schlesischesTorSolidsV267(native=false):SchlesischesTorSolidV267[]{
  const solids=schlesischesTorStructuralRowsV267(native,!native).map(rowSolid);
  if(native){
    const decks=schlesischesTorStructuralRowsV267().filter(r=>r.role==='mapped-west-viaduct-deck').map(nativeDeckSolid);
    return[...solids,...decks,{ring:[[4686.6,2093.4],[4732.8,2093.4],[4732.8,2134.8],[4686.6,2134.8]],holes:[],minY:data.nativeBaseTopY-.02,maxY:Math.ceil((data.baseTopY+5.7)/.2)*.2,sourceId:'schlesisches-tor-v267-native-roof-envelope',topAt:(x,z)=>{
      const y=schlesischesTorRoofAtV267((Math.floor(x/.6)+.5)*.6,(Math.floor(z/.6)+.5)*.6);
      return y===null?Number.NEGATIVE_INFINITY:Math.ceil(y/.2)*.2;
    }}];
  }
  const roofs=data.roofs.map(r=>({ring:r.ring,holes:[],minY:data.baseTopY-.02,maxY:data.baseTopY+r.rise+.03,sourceId:'schlesisches-tor-v267-'+r.name,topAt:(x:number,z:number)=>hipHeight(r,x,z)??Number.NEGATIVE_INFINITY}));
  const ring=Array.from({length:48},(_,i)=>[data.tower.centre[0]+4.95*Math.cos(i*Math.PI/24),data.tower.centre[1]+4.95*Math.sin(i*Math.PI/24)]);
  return[...solids,...roofs,{ring,holes:[],minY:data.baseTopY-.02,maxY:data.baseTopY+5.7,sourceId:'schlesisches-tor-v267-tower-roof',topAt:(x:number,z:number)=>towerHeight(x,z)??Number.NEGATIVE_INFINITY}];
}
