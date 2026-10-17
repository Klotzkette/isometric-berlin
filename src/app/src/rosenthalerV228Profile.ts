import source from "./data/rosenthalerV228.json";

export const ROSENTHALER_V228_GROUP = "Rosenthaler Platz mapped shopfronts and four U8 stair entrances v228";
export const ROSENTHALER_STAIRS_V228 = source.stairs.map(s => {
  const dx=s.bottom[0]-s.top[0],dz=s.bottom[1]-s.top[1],length=Math.hypot(dx,dz);
  return {...s,length,ux:dx/length,uz:dz/length,nx:-dz/length,nz:dx/length};
});
export const ROSENTHALER_OPENINGS_V228 = ROSENTHALER_STAIRS_V228.map(s=>{
  const p=(u:number,v:number):[number,number]=>[s.top[0]+s.ux*u+s.nx*v,s.top[1]+s.uz*u+s.nz*v];
  return {sourceId:s.osmWay,surfaceY:s.surfaceY,nativeSurfaceY:s.nativeSurfaceY,depth:s.descent,
    ring:[p(0,-s.width/2),p(s.length,-s.width/2),p(s.length,s.width/2),p(0,s.width/2)]};
});
export const ROSENTHALER_V228_OPENINGS=ROSENTHALER_OPENINGS_V228;

/** Exact mapped run envelopes; unsurveyed 2.5m clear width is documented. */
export function rosenthalerEntranceAtV228(x:number,z:number) {
  for(const run of ROSENTHALER_STAIRS_V228) {
    const dx=x-run.top[0],dz=z-run.top[1],u=dx*run.ux+dz*run.uz,v=dx*run.nx+dz*run.nz;
    if(u>=0&&u<=run.length&&Math.abs(v)<=run.width/2) return {run,u,v};
  }
  return null;
}
export function rosenthalerEntranceFloorAtV228(x:number,z:number,native=false):number|null {
  const hit=rosenthalerEntranceAtV228(x,z);if(!hit)return null;
  const {run,u}=hit,step=Math.min(run.stepCount,Math.floor(u/(run.length-run.landing)*run.stepCount));
  return (native?run.nativeSurfaceY:run.surfaceY)-step*run.descent/run.stepCount;
}
export const rosenthalerV228FloorAt=rosenthalerEntranceFloorAtV228;

/** Only the two represented rail/wall sides and closed bottom landing collide. */
export function rosenthalerV228SolidAt(x:number,y:number,z:number,radius=0,native=false):boolean {
  return ROSENTHALER_STAIRS_V228.some(s=>{
    const base=native?s.nativeSurfaceY:s.surfaceY;
    if(y<base-s.descent-.15||y>base+1.12)return false;
    const dx=x-s.top[0],dz=z-s.top[1],u=dx*s.ux+dz*s.uz,v=dx*s.nx+dz*s.nz;
    return (u>=-radius&&u<=s.length+radius&&Math.abs(Math.abs(v)-(s.width/2+.11))<=.13+radius)
      ||(Math.abs(u-(s.length+.11))<=.11+radius&&Math.abs(v)<=s.width/2+.20+radius);
  });
}

/** Three represented sides only; the mapped upper pavement approach stays open. */
export const ROSENTHALER_BARRIERS_V228=ROSENTHALER_OPENINGS_V228.flatMap(({ring,sourceId},i)=>
  [[ring[0],ring[1]],[ring[1],ring[2]],[ring[2],ring[3]]].map(([a,b])=>({a,b,radius:.14,sourceId,
    bottom:Math.min(ROSENTHALER_STAIRS_V228[i].surfaceY,ROSENTHALER_STAIRS_V228[i].nativeSurfaceY)-ROSENTHALER_STAIRS_V228[i].descent-.15,
    top:Math.max(ROSENTHALER_STAIRS_V228[i].surfaceY,ROSENTHALER_STAIRS_V228[i].nativeSurfaceY)+1.15})));

/** SAT, preserving native cells wholly outside the actual stair-mouth envelope. */
export function rosenthalerOpeningIntersectsCellV228(x:number,z:number,size:number):boolean {
  return ROSENTHALER_STAIRS_V228.some(s=>{
    const dx=x+size/2-(s.top[0]+s.bottom[0])/2,dz=z+size/2-(s.top[1]+s.bottom[1])/2;
    return Math.abs(dx)<Math.abs(s.ux)*s.length/2+Math.abs(s.nx)*s.width/2+size/2
      &&Math.abs(dz)<Math.abs(s.uz)*s.length/2+Math.abs(s.nz)*s.width/2+size/2
      &&Math.abs(dx*s.ux+dz*s.uz)<s.length/2+size/2*(Math.abs(s.ux)+Math.abs(s.uz))
      &&Math.abs(dx*s.nx+dz*s.nz)<s.width/2+size/2*(Math.abs(s.nx)+Math.abs(s.nz));
  });
}
