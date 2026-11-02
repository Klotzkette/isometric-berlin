import type { PedestrianEnvironment } from "./pedestrianNavigation";
import { wallGalleryHistoricSolidAtV298 } from "./wallGalleryV298Profile";
import { courtsParkV293GroundAt, courtsParkV293SolidAt } from "./courtsParkV293Profile";
import { diningFloorAtV296, diningOpeningContainsV296, diningSolidAtV296, PARLIAMENTARY_DINING_V296 } from "./parliamentaryDiningV296Profile";
import { waterfrontGroundAtV296, waterfrontOpeningContainsV296, waterfrontArcadeSolidAtV296, WATERFRONT_ARCADE_RECEIPT_V296 } from "./waterfrontV296Profile";
import { southFidelitySolidsV294, southFidelityContainsV294, southFidelitySegmentDistanceV294 } from "./SouthFidelityV294";

export type FidelityAdmissionV296 = { courtsPark?: boolean; dining?: boolean; waterfront?: boolean; south?: boolean; wallGallery?:boolean; native?: boolean };
type Solid = ReturnType<typeof southFidelitySolidsV294>[number];
const southCache: Array<Map<string,Solid[]> | undefined> = [];
function southGrid(native:boolean):Map<string,Solid[]> {
  const cached=southCache[+native];if(cached)return cached;
  const grid=new Map<string,Solid[]>();
  for(const s of southFidelitySolidsV294(native)){
    const xs=s.ring.map(p=>p[0]),zs=s.ring.map(p=>p[1]);
    for(let ix=Math.floor((Math.min(...xs)-.6)/32);ix<=Math.floor((Math.max(...xs)+.6)/32);ix++)
      for(let iz=Math.floor((Math.min(...zs)-.6)/32);iz<=Math.floor((Math.max(...zs)+.6)/32);iz++){
        const key=`${ix},${iz}`,rows=grid.get(key)??[];rows.push(s);grid.set(key,rows);
      }
  }
  southCache[+native]=grid;return grid;
}
function southPointSolid(x:number,y:number,z:number,radius:number,native:boolean):boolean {
  for(const s of southGrid(native).get(`${Math.floor(x/32)},${Math.floor(z/32)}`)??[]){
    if(y<s.minY||y>s.maxY)continue;
    const ring=s.ring;
    if(southFidelityContainsV294(ring,x,z)||ring.some((a,i)=>southFidelitySegmentDistanceV294(x,z,a,ring[(i+1)%ring.length])<radius))return true;
  }
  return false;
}
/** Bind only completed models to this environment. The live admission getter
 * follows mode/world switches; it never opens an unmatched source building. */
export function installFidelityNavigationV296(environment:PedestrianEnvironment, admission:()=>FidelityAdmissionV296):void {
  const oldGround=environment.interiorGroundAt,oldSolid=environment.interiorSolidAt,oldInterior=environment.walkableInteriorAt;
  environment.interiorGroundAt=(x,z,current)=>{
    const a=admission(),hint=current??environment.groundAt(x,z)??0;
    if(a.dining){const y=diningFloorAtV296(x,z,hint,NaN);if(Number.isFinite(y))return y;}
    if(a.courtsPark){const y=courtsParkV293GroundAt(x,z,hint,NaN,a.native===true);if(Number.isFinite(y))return y;}
    if(a.waterfront){const y=waterfrontGroundAtV296(x,z,a.native===true);if(y!==null&&hint>=y-.6&&hint<=y+2)return y;}
    return oldGround?.(x,z,current)??null;
  };
  environment.interiorSolidAt=(x,y,z,radius=0)=>{
    const a=admission();
    if(a.wallGallery&&wallGalleryHistoricSolidAtV298(x,y,z,radius,a.native===true))return true;
    if(a.courtsPark&&courtsParkV293SolidAt(x,z,y,0,radius))return true;
    if(a.dining&&diningSolidAtV296(x,z,y,0,radius))return true;
    if(a.waterfront&&waterfrontArcadeSolidAtV296(x,y,z,radius,a.native===true))return true;
    if(a.south&&southPointSolid(x,y,z,radius,a.native===true))return true;
    return oldSolid?.(x,y,z,radius)??false;
  };
  environment.walkableInteriorAt=(x,y,z,id)=>{
    const a=admission();
    if(a.waterfront&&id===WATERFRONT_ARCADE_RECEIPT_V296.prism.id&&waterfrontOpeningContainsV296(x,y,z,a.native===true))return true;
    if(a.dining&&id&&diningOpeningContainsV296(x,y,z)){
      const p=PARLIAMENTARY_DINING_V296;
      if((p.lampenladen.sourceIds as readonly string[]).includes(id)||(p.marie.sourceIds as readonly string[]).includes(id))return true;
    }
    return oldInterior?.(x,y,z,id)??false;
  };
}
