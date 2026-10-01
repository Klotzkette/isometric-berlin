import source from "./data/eastSquaresV163Sources.json";
export const EAST_SQUARES_V163_SOURCE=source;
export const EAST_SQUARES_V163_GROUP_NAME="Eastern squares source-bound public art v163";
export const MINECRAFT_EAST_SQUARES_V163_GROUP_NAME="Minecraft eastern squares public art v163";
export const EAST_SQUARES_V163_OSM_KEYS=Object.freeze(Object.values(source.features).map(f=>f.osmKey));
export const EAST_SQUARES_V163_TARGETS=Object.freeze(Object.entries(source.features).map(([id,f])=>({id,name:f.name,position:[f.centerXZ[0],f.groundY,f.centerXZ[1]] as const})));
/** Sculptural solids only: never close the square, mosaic or open underside of the clock. */
export function eastSquaresV163SolidAt(x:number,z:number,y:number,radius=0):boolean {
  const clock=source.features.worldClock,[cx,cz]=clock.centerXZ;if(Math.hypot(x-cx,z-cz)<.75+radius&&y>=3&&y<5.7)return true;
  const f=source.features.friendship,[fx,fz]=f.centerXZ;if(Math.hypot(x-fx,z-fz)<6.65+radius&&y>=3&&y<4.4)return true;
  const ring=source.features.floatingRing,[rx,rz]=ring.centerXZ,r=Math.hypot(x-rx,z-rz);if(r>5.6+radius||r<4.8-radius||y<3.16||y>7.96)return false;
  if(y>=5.38){const a=Math.atan2(z-rz,x-rx),sector=Math.round((a/(2*Math.PI)*16)-.5),t=(sector+.5)*2*Math.PI/16,u=-(x-rx)*Math.sin(t)+(z-rz)*Math.cos(t);return Math.abs(u)<.8+radius;}
  for(let i=0;i<8;i++){const t=i*Math.PI/4;if(Math.hypot(x-rx-Math.cos(t)*5.1,z-rz-Math.sin(t)*5.1)<.15+radius)return true;}return false;
}
