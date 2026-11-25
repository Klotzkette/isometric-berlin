import { nativeRitzCanopyRingsV385, ritzCanopyRingV385, ritzCanopySoffitV385 as bottom, ritzCanopyTopV385 as top } from './ritzCanopyProfileV385';
import { RitzSurfacesV385, type RitzVertex } from './RitzSurfacesV385';

/** Thin roof and illuminated panel grid from the source quadrilateral and street photograph. */
export function createRitzCanopyV385(native:boolean) {
  const surface=new RitzSurfacesV385();
  const rings=native?nativeRitzCanopyRingsV385():[ritzCanopyRingV385];
  const point=([x,z]:number[],y:number):RitzVertex=>[x,y,z];
  for (const ring of rings) {
    const [a,b,c,d]=ring.map(p=>point(p,top));
    const [e,f,g,h]=ring.map(p=>point(p,bottom));
    surface.quad(d,c,b,a,0x655f53); surface.quad(e,f,g,h,0x413b34);
    for(let j=0;j<4;j++) {
      const p=ring[j],q=ring[(j+1)%4];
      surface.quad(point(p,bottom),point(q,bottom),point(q,top),point(p,top),0x403e36);
    }
  }
  const [fl,bl,br,fr]=ritzCanopyRingV385;
  function panel(u:number,v:number): RitzVertex {
    const x=(1-v)*(bl[0]+u*(br[0]-bl[0]))+v*(fl[0]+u*(fr[0]-fl[0]));
    const z=(1-v)*(bl[1]+u*(br[1]-bl[1]))+v*(fl[1]+u*(fr[1]-fl[1]));
    return [x,bottom-.018,z];
  }
  // Inside the stepped native outline the same square lighting grid is legible from below.
  for(let j=0;j<6;j++) for(let i=0;i<8;i++) {
    const u=(i+.5)/8,v=(j+.5)/6;
    const a=panel(u-.056,v-.073),b=panel(u+.056,v-.073),c=panel(u+.056,v+.073),d=panel(u-.056,v+.073);
    if(native) {const mid=panel(u,v);for(const [k,p] of [a,b,c,d].entries()) {p[0]=mid[0]+(k===0||k===3?-.42:.42);p[2]=mid[2]+(k<2?-.37:.37);}}
    surface.quad(a,b,c,d,0xc2b8a2);
    if(i===0||i===7) continue;
    const [x,y,z]=panel(u,v),s=.135;
    surface.quad([x-s,y-.018,z-s],[x+s,y-.018,z-s],[x+s,y-.018,z+s],[x-s,y-.018,z+s],0xffedc6);
  }
  return surface.mesh('The Ritz-Carlton · freitragendes Vordach (DEBE01YYK0003V2X)',native);
}
