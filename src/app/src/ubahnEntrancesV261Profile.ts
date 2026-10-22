import source from "./data/ubahnEntrancesV261.json";

export const UBAHN_V261_GROUP = "Naturkundemuseum and Brandenburger Tor mapped entrances v261";
export const UBAHN_STAIRS_V261 = source.stairs.map(s => {
  const dx=s.bottom[0]-s.top[0],dz=s.bottom[1]-s.top[1],length=Math.hypot(dx,dz);
  return {...s,length,ux:dx/length,uz:dz/length,nx:-dz/length,nz:dx/length};
});
export const UBAHN_OPENINGS_V261 = UBAHN_STAIRS_V261.map(s=>{
  const p=(u:number,v:number):[number,number]=>[s.top[0]+s.ux*u+s.nx*v,s.top[1]+s.uz*u+s.nz*v];
  return {sourceId:s.osmWay,surfaceY:s.surfaceY,nativeSurfaceY:s.nativeSurfaceY,depth:s.descent,
    ring:[p(0,-s.width/2),p(s.length,-s.width/2),p(s.length,s.width/2),p(0,s.width/2)]};
});
export const UBAHN_V261_OPENINGS=UBAHN_OPENINGS_V261;

/** Exact mapped run envelopes; unsurveyed clear widths is documented. */
export function ubahnEntranceAtV261(x:number,z:number) {
  for(const run of UBAHN_STAIRS_V261) {
    const dx=x-run.top[0],dz=z-run.top[1],u=dx*run.ux+dz*run.uz,v=dx*run.nx+dz*run.nz;
    if(u>=0&&u<=run.length&&Math.abs(v)<=run.width/2) return {run,u,v};
  }
  return null;
}
export function ubahnEntranceFloorAtV261(x:number,z:number,native=false):number|null {
  const hit=ubahnEntranceAtV261(x,z);if(!hit)return null;
  const {run,u}=hit,step=Math.min(run.stepCount,Math.floor(u/(run.length-run.landing)*run.stepCount));
  return (native?run.nativeSurfaceY:run.surfaceY)-step*run.descent/run.stepCount;
}
export const ubahnV261FloorAt=ubahnEntranceFloorAtV261;

/** Only the two represented rail/wall sides and closed bottom landing collide. */
export function ubahnV261SolidAt(x:number,y:number,z:number,radius=0,native=false):boolean {
  return UBAHN_STAIRS_V261.some(s=>{
    const base=native?s.nativeSurfaceY:s.surfaceY;
    if(y<base-s.descent-.15||y>base+1.12)return false;
    const dx=x-s.top[0],dz=z-s.top[1],u=dx*s.ux+dz*s.uz,v=dx*s.nx+dz*s.nz;
    return (u>=-radius&&u<=s.length+radius&&Math.abs(Math.abs(v)-(s.width/2+.11))<=.13+radius)
      ||(Math.abs(u-(s.length+.11))<=.11+radius&&Math.abs(v)<=s.width/2+.20+radius);
  });
}

/** Three represented sides only; the mapped upper pavement approach stays open. */
export const UBAHN_BARRIERS_V261=UBAHN_OPENINGS_V261.flatMap(({ring,sourceId},i)=>
  [[ring[0],ring[1]],[ring[1],ring[2]],[ring[2],ring[3]]].map(([a,b])=>({a,b,radius:.14,sourceId,
    bottom:Math.min(UBAHN_STAIRS_V261[i].surfaceY,UBAHN_STAIRS_V261[i].nativeSurfaceY)-UBAHN_STAIRS_V261[i].descent-.15,
    top:Math.max(UBAHN_STAIRS_V261[i].surfaceY,UBAHN_STAIRS_V261[i].nativeSurfaceY)+1.15})));

/** SAT, preserving native cells wholly outside the actual stair-mouth envelope. */
export function ubahnOpeningIntersectsCellV261(x:number,z:number,size:number):boolean {
  return UBAHN_STAIRS_V261.some(s=>{
    const dx=x+size/2-(s.top[0]+s.bottom[0])/2,dz=z+size/2-(s.top[1]+s.bottom[1])/2;
    return Math.abs(dx)<Math.abs(s.ux)*s.length/2+Math.abs(s.nx)*s.width/2+size/2
      &&Math.abs(dz)<Math.abs(s.uz)*s.length/2+Math.abs(s.nz)*s.width/2+size/2
      &&Math.abs(dx*s.ux+dz*s.uz)<s.length/2+size/2*(Math.abs(s.ux)+Math.abs(s.uz))
      &&Math.abs(dx*s.nx+dz*s.nz)<s.width/2+size/2*(Math.abs(s.nx)+Math.abs(s.nz));
  });
}
