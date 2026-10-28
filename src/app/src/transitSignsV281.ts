import { letteringLayout, letteringStrokePaths } from "./drawnLettering";

type Frame = { top: number[]; ux: number; uz: number; nx: number; nz: number; width: number; base: number; name: string };
type Point = [number, number, number];

/** A real mapped stair owns the fitting. This helper never creates an entrance. */
export function appendHistoricPortalV281(rows: number[][], rods: number[][], f: Frame, native: boolean): void {
  const yaw=-Math.atan2(f.uz,f.ux), at=(u:number,v:number,y:number):Point=>[f.top[0]+f.ux*u+f.nx*v,f.base+y,f.top[1]+f.uz*u+f.nz*v];
  const box=(u:number,v:number,y:number,w:number,h:number,d:number,color:number)=>{
    if(!native){rows.push([...at(u,v,y),w,h,d,yaw,color]);return;}
    const count=Math.max(1,Math.ceil(d/.16));
    for(let i=0;i<count;i++)rows.push([...at(u,v-d/2+(i+.5)*d/count,y),
      Math.abs(f.ux)*w+Math.abs(f.nx)*d/count,h,Math.abs(f.uz)*w+Math.abs(f.nz)*d/count,color]);
  };
  // The photographed Oranienburger portal has a single blue name/U panel,
  // rounded upper frame corners and two green posts, unlike the modern Tor.
  for(const side of [-1,1])box(-.14,side*(f.width/2+.18),1.9,.14,3.8,.14,0x34564c);
  box(-.14,0,4.02,.14,.14,f.width-.10,0x34564c);
  for(const side of [-1,1])for(let k=0;k<5;k++){
    const angle=(k+.5)/5*Math.PI/2;
    box(-.14,side*(f.width/2-.18+.36*Math.cos(angle)),3.66+.36*Math.sin(angle),.14,.11,.13,0x34564c);
  }
  box(-.14,0,2.59,.14,.10,f.width+.36,0x34564c);
  const nu=native?(Math.abs(f.ux)>Math.abs(f.uz)?[Math.sign(f.ux),0]:[0,Math.sign(f.uz)]):[f.ux,f.uz],nv=[-nu[1],nu[0]],centre=at(-.14,0,3.30);
  const sp=(u:number,v:number,y:number):Point=>[centre[0]+nu[0]*u+nv[0]*v,centre[1]+y,centre[2]+nu[1]*u+nv[1]*v];
  const sb=(u:number,v:number,y:number,w:number,h:number,d:number,color:number)=>{
    if(native)rows.push([...sp(u,v,y),Math.abs(nu[0])*w+Math.abs(nv[0])*d,h,Math.abs(nu[1])*w+Math.abs(nv[1])*d,color]);
    else rows.push([...sp(u,v,y),w,h,d,yaw,color]);
  };
  const width=f.width+.12;
  sb(0,0,0,.12,1.38,width,0x23508c);
  const text=f.name.toUpperCase(), cap=.16*Math.min(1,(width-.20)/letteringLayout(text,.16).totalWidthM);
  for(const face of [-1,1]){
    for(const side of [-1,1])sb(face*.078,side*.25,.22,.025,.55,.14,0xf2ebce);
    sb(face*.078,0,-.04,.025,.14,.50,0xf2ebce);
    for(const path of letteringStrokePaths(text,cap))for(let i=1;i<path.length;i++){
      const a=sp(face*.08,-face*path[i-1][0],-.47+path[i-1][1]),b=sp(face*.08,-face*path[i][0],-.47+path[i][1]);
      if(!native)rods.push([...a,...b,.018,0xf2ebce]);
      else{
        const n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2])/.025));
        for(let j=0;j<n;j++){const t=(j+.5)/n;rows.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t,.024,.024,.024,0xf2ebce]);}
      }
    }
  }
}

/** Keep the modern stainless/glass identity at the Gate. The paired S/U
 * markers sit in a supported side frame; no bar closes the stair approach. */
export function appendModernTorSignsV281(rows:number[][],rods:number[][],native:boolean,f:Frame):void {
  const ux=native?(Math.abs(f.ux)>Math.abs(f.uz)?Math.sign(f.ux):0):f.ux;
  const uz=native?(Math.abs(f.uz)>Math.abs(f.ux)?Math.sign(f.uz):0):f.uz;
  const nx=-uz,nz=ux, yaw=-Math.atan2(nz,nx);
  const centre:Point=[f.top[0]+f.ux*.92+f.nx*(f.width/2+.19),f.base+1.52,f.top[1]+f.uz*.92+f.nz*(f.width/2+.19)];
  const box=(u:number,v:number,y:number,w:number,h:number,d:number,c:number)=>{
    const p=[centre[0]+nx*u+ux*v,centre[1]+y,centre[2]+nz*u+uz*v];
    if(native)rows.push([...p,Math.abs(nx)*w+Math.abs(ux)*d,h,Math.abs(nz)*w+Math.abs(uz)*d,c]);
    else rows.push([...p,w,h,d,yaw,c]);
  };
  // All supports remain on the side-wall line, well clear of the descending floor.
  for(const side of [-1,1])box(0,side*.90,-.46,.07,1.90,.07,0x858f90);
  for(const y of [-.02,.46])box(0,0,y,.07,.07,1.87,0x858f90);
  for(const [v,color] of [[-.43,0x237447],[.43,0x23508c]])box(.018,v,0,.12,.72,.72,color);
  box(0,0,-.53,.12,.22,1.87,0xdedccb);
  const cap=.085*Math.min(1,1.65/letteringLayout(f.name.toUpperCase(),.085).totalWidthM);
  for(const face of [-1,1]){
    for(const side of [-1,1])box(face*.087,.43+side*.19,.045,.024,.39,.10,0xf2ebce);
    box(face*.087,.43,-.15,.024,.10,.38,0xf2ebce);
    // Independently authored five-stroke S, front and back both legible.
    const s=[[-.43,.22,.40,.08],[-.60,.11,.08,.22],[-.43,0,.40,.08],[-.26,-.11,.08,.22],[-.43,-.22,.40,.08]];
    for(const [v,y,d,h] of s)box(face*.087,-.43+(v+.43)*face,y,.024,h,d,0xf2ebce);
    for(const path of letteringStrokePaths(f.name.toUpperCase(),cap))for(let i=1;i<path.length;i++){
      const point=(p:number[]):Point=>[centre[0]+nx*face*.08+ux*face*p[0],centre[1]-.53-cap/2+p[1],centre[2]+nz*face*.08+uz*face*p[0]];
      const a=point(path[i-1]),b=point(path[i]);
      if(!native)rods.push([...a,...b,.012,0x31464d]);
      else{
        const n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2])/.022));
        for(let j=0;j<n;j++){const t=(j+.5)/n;rows.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t,.018,.018,.018,0x31464d]);}
      }
    }
  }
}
