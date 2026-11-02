import course from './data/rollerachtV293.json';
/** Immutable mapped Rolleracht course. Vertical fitting values are display estimates. */
export const COURTS_PARK_V293_PROFILE = {
  schema: 293, fullStaticDetailOnTouch: true, independentNative: true,
  noNewTextures: true, noFrameWork: true, previousOwnersRetained: true,
  maxDrawnInstances: 11000, maxNativeInstances: 29000, maxGpuBytes: 2800000,
  courtSites: ['wedding', 'charlottenburg', 'moabit'],
  churchSites: ['st-johannis', 'heilandskirche'],
  bridgeSource: 'way/116946775', lowerCourseSource: 'way/116946778',
  bridgeEnds: [[-1587.6548926254036, -750.0701107764617], [-1582.1554510252317, -754.5956901395693]],
  groundY: 5.245, bridgeDeckRise: 2.5, bridgeWidth: 3.0, bridgeSlab: .22,
  bridgeClearance: 2.28, rampRun: 11, rampWidth: 3,
  verticalStatus: 'Unsurveyed photo/context display estimate; mapped XZ courses retained',
} as const;
const p = COURTS_PARK_V293_PROFILE;
const [a,b]=p.bridgeEnds, dx=b[0]-a[0],dz=b[1]-a[1];
export const ROLLERACHT_V293 = {cx:(a[0]+b[0])/2,cz:(a[1]+b[1])/2,length:Math.hypot(dx,dz),ux:dx/Math.hypot(dx,dz),uz:dz/Math.hypot(dx,dz)} as const;
export function rollerachtV293Local(x:number,z:number):[number,number]{const r=ROLLERACHT_V293;return [(x-r.cx)*r.ux+(z-r.cz)*r.uz,-(x-r.cx)*r.uz+(z-r.cz)*r.ux];}
/** Shared mapped approach segments drive both actual slabs and walking support. */
export const ROLLERACHT_V293_APPROACHES = [0,1].flatMap(end=>{
 const points=end===0?[...course.track].reverse():course.track;
 let run=0,prev:readonly number[]=end===0?a:b;const result:{a:readonly number[];b:readonly number[];run:number;length:number}[]=[];
 for(let i=1;i<points.length&&run<p.rampRun;i++){const next=points[i],length=Math.hypot(next[0]-prev[0],next[1]-prev[1]);if(length<1e-5)continue;const used=Math.min(length,p.rampRun-run),t=used/length;result.push({a:prev,b:[prev[0]+(next[0]-prev[0])*t,prev[1]+(next[1]-prev[1])*t],run,length:used});run+=used;prev=next;}
 return result;
});
/** No height promotion from the lower tube to the bridge; approach and feet gates agree. */
export function courtsParkV293GroundAt(x:number,z:number,feetY:number,fallback:number,native=false):number {
 const [u,v]=rollerachtV293Local(x,z),half=ROLLERACHT_V293.length/2;
 if(Math.abs(u)<=half && Math.abs(v)<=p.bridgeWidth/2){const y=p.groundY+p.bridgeDeckRise;return feetY>=y-.55?y:fallback;}
 for(const segment of ROLLERACHT_V293_APPROACHES){const dx=segment.b[0]-segment.a[0],dz=segment.b[1]-segment.a[1],raw=((x-segment.a[0])*dx+(z-segment.a[1])*dz)/(dx*dx+dz*dz);if(raw<-.003||raw>1.003)continue;const t=Math.max(0,Math.min(1,raw));if(Math.hypot(x-segment.a[0]-dx*t,z-segment.a[1]-dz*t)>p.rampWidth/2+.04)continue;
  const rise=p.bridgeDeckRise*(1-(segment.run+segment.length*t)/p.rampRun),y=p.groundY+(native?Math.ceil(rise/.125)*.125:rise);if(feetY>=y-.55)return y;
 }
 return fallback;
}
/** Exact deck and side rails. Both ends and the full lower tube stay open. */
export function courtsParkV293SolidAt(x:number,z:number,feetY:number,height=1.8,radius=.28):boolean {
 const [u,v]=rollerachtV293Local(x,z),half=ROLLERACHT_V293.length/2;
 if(Math.abs(u)>half+.25 || Math.abs(v)>p.bridgeWidth/2+.16+radius)return false;
 const deck=p.groundY+p.bridgeDeckRise;
 if(Math.abs(v)<p.bridgeWidth/2+radius && Math.abs(u)>2.0-radius && feetY<p.groundY+2.3 && feetY+height>p.groundY)return true;

 if(Math.abs(v)<p.bridgeWidth/2+radius && feetY+height>deck-p.bridgeSlab && feetY<deck-.04)return true;
 if(Math.abs(u)<1.85 && Math.abs(v)>p.bridgeWidth/2-.24-radius){const ceiling=p.groundY+.72+1.65*Math.sqrt(Math.max(0,1-(u/1.85)**2))-.13;if(feetY+height>ceiling && feetY<deck)return true;}
 const rail=Math.abs(v)>p.bridgeWidth/2-.14-radius;
 return rail && feetY+height>deck+.08 && feetY<deck+1.08;
}
