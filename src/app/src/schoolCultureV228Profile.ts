import source from './data/schoolCultureV228.json';

// Copy only collision/support coordinates. No module-level reference to a site,
// boxes, rods, labels or nativeRows can keep the weak renderer payload resident.
const navigation = (()=>{
  const church=source.sites.find(s=>s.key==='sophienkirche')!;
  const shape=church.recognition!;
  const triangles=church.sheets.flatMap(s=>[[s.ring[0],s.ring[1],s.ring[2]],[s.ring[0],s.ring[2],s.ring[3]]].map(t=>t.map(p=>[...p])));
  const faces=new Float32Array(church.nativeRows.length*5);
  const index=new Map<number,number[]>();
  church.nativeRows.forEach((r,i)=>{
    const a=r[0]-r[3]/2,b=r[2]-r[5]/2,c=r[0]+r[3]/2,d=r[2]+r[5]/2;
    faces.set([a,b,c,d,r[1]+r[4]/2],i*5);
    for(let gx=Math.floor(a/2);gx<=Math.floor(c/2);gx++)for(let gz=Math.floor(b/2);gz<=Math.floor(d/2);gz++){
      const key=gx*4096+gz;
      const ids=index.get(key);if(ids)ids.push(i*5);else index.set(key,[i*5]);
    }
  });
  return {owner:church.owner,center:[...shape.towerCenter],ring:shape.towerFootprint.map(p=>[...p]),triangles,faces,index};
})();
/** Exact shared tower footprint; no new obstruction outside the old church. */
export const SCHOOL_CULTURE_V228_TOWER = {
  id:'sophienkirche-recognition-v228',sourceOwner:navigation.owner,
  ring:navigation.ring,holes:[],low:18.6,high:72.6,
};
const tiers = [[9.1,38],[7.9,49],[6.4,60]];

function triangleY(x:number,z:number,a:number[],b:number[],c:number[]):number|null {
  const determinant=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
  if(Math.abs(determinant)<1e-9)return null;
  const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/determinant;
  const v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/determinant;
  return u>=-1e-7&&v>=-1e-7&&u+v<=1.0000001?u*a[1]+v*b[1]+(1-u-v)*c[1]:null;
}
function supportAt(x:number,z:number,limit:number,native:boolean):number|null {
  if(x<1937||x>1994||z< -715||z> -680)return null;
  let y:number|null=null;
  if(native){
    const f=navigation.faces;
    for(const i of navigation.index.get(Math.floor(x/2)*4096+Math.floor(z/2))??[]){
      if(x>=f[i]&&z>=f[i+1]&&x<=f[i+2]&&z<=f[i+3]&&f[i+4]<=limit&&(y===null||f[i+4]>y))y=f[i+4];
    }
    return y;
  }
  const dx=x-navigation.center[0],dz=z-navigation.center[2];
  const u=dx*.969015-dz*.246998,v=dx*.246998+dz*.969015;
  for(const [width,top] of tiers)if(Math.abs(u)<=width/2&&Math.abs(v)<=width/2&&top<=limit)y=top;
  if(Math.hypot(u,v)<=.15&&72.6<=limit)y=72.6;
  for(const [a,b,c] of navigation.triangles){
    const hit=triangleY(x,z,a,b,c);
    if(hit!==null&&hit<=limit&&(y===null||hit>y))y=hit;
  }
  return y;
}
/** Full support: drawn sheets or actual native block tops, never cross-mode rounding. */
export function schoolCultureV228RoofAt(x:number,z:number,native=false):number|null {
  return supportAt(x,z,Infinity,native);
}
/** Ground-level walkers must never teleport to the new roof or tower top. */
export function schoolCultureV228GroundAt(x:number,z:number,feetY:number,native=false):number|null {
  return supportAt(x,z,feetY+.55,native);
}
/** Added volume above the retained owner; approach and original ground are unchanged. */
export function schoolCultureV228SolidAt(x:number,y:number,z:number,radius=0,native=false):boolean {
  if(y<18.6)return false;
  const roof=schoolCultureV228RoofAt(x,z,native);
  if(roof!==null&&y<roof)return true;
  if(radius<=0)return false;
  const a=schoolCultureV228RoofAt(x+radius,z,native),b=schoolCultureV228RoofAt(x-radius,z,native);
  const c=schoolCultureV228RoofAt(x,z+radius,native),d=schoolCultureV228RoofAt(x,z-radius,native);
  return [a,b,c,d].some(top=>top!==null&&y<top);
}
