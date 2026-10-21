import source from "./data/littenInstanzV257.json";
import { letteringStrokePaths } from "./drawnLettering";

type Face = {a:number[];b:number[];normal:number[];contour?:number[][]};
const STONE=0xc8bea8, LIGHT=0xd8ceb8, DARK=0x817461, GLASS=0x4b6064, IRON=0x424a45;

/** Shallow source-bound fittings merged into the existing v183 justice batch. */
export function littenInstanzV257Rows(native=false): number[][] {
  const rows:number[][]=[];
  function facade(face:Face) {
    const dx=face.b[0]-face.a[0],dz=face.b[1]-face.a[1],length=Math.hypot(dx,dz),ux=dx/length,uz=dz/length;
    const contour=face.contour?.map(p=>({u:(p[0]-face.a[0])*ux+(p[1]-face.a[1])*uz,p}));
    function point(u:number,out:number) {
      if(contour) for(let i=1;i<contour.length;i++) {
        const a=contour[i-1],b=contour[i];
        if(u<a.u||u>b.u||b.u-a.u<.001) continue;
        const t=(u-a.u)/(b.u-a.u),dx=b.p[0]-a.p[0],dz=b.p[1]-a.p[1],l=Math.hypot(dx,dz),nx=-dz/l,nz=dx/l;
        return [a.p[0]+dx*t+nx*out,a.p[1]+dz*t+nz*out,dx/l,dz/l];
      }
      return [face.a[0]+ux*u+face.normal[0]*out,face.a[1]+uz*u+face.normal[1]*out,ux,uz];
    }
    function member(u:number,y:number,w:number,h:number,color:number,depth=.12,out=.28) {
      if (!native) {
        const n=contour?Math.max(1,Math.ceil(w/.65)):1;
        for(let i=0;i<n;i++) {const p=point(u-w/2+(i+.5)*w/n,out);rows.push([p[0],y,p[1],w/n,h,depth,-Math.atan2(p[3],p[2]),color]);}
      }
      else {
        // Independent exterior block strips, not rotated drawn rectangles.
        const n=Math.max(1,Math.ceil(w/.55));
        for(let i=0;i<n;i++) {
          const p=point(u-w/2+(i+.5)*w/n,out+1.05);
          rows.push([p[0],y,p[1],Math.max(.16,Math.abs(p[2])*w/n),h,Math.max(.16,Math.abs(p[3])*w/n),color]);
        }
      }
    }
    function arc(u:number,y:number,w:number,rise:number,color:number,thickness=.16,out=.5) {
      const n=native?24:40;
      for(let i=0;i<n;i++) {
        const a=Math.PI*i/n,b=Math.PI*(i+1)/n;
        const x1=Math.cos(a)*w/2,x2=Math.cos(b)*w/2,y1=Math.sin(a)*rise,y2=Math.sin(b)*rise;
        member(u+(x1+x2)/2,y+(y1+y2)/2,Math.abs(x2-x1)+thickness,Math.abs(y2-y1)+thickness,color,.14,out);
      }
    }
    function window(u:number,y:number,w:number,h:number,trim=LIGHT) {
      member(u,y,w,h,GLASS,.06,.3);
      for(const x of [-w/2,0,w/2]) member(u+x,y,.09,h+.18,trim,.12,.38);
      for(const yy of [-h/2,0,h/2]) member(u,y+yy,w+.2,.10,trim,.14,.39);
      member(u,y-h/2-.13,w+.34,.14,trim,.28,.45);
    }
    function label(text:string,u:number,y:number,height:number,color:number) {
      for(const path of letteringStrokePaths(text,height)) for(let i=1;i<path.length;i++) {
        const a=path[i-1],b=path[i],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.07));
        for(let j=0;j<n;j++){const t=(j+.5)/n;member(u+a[0]+(b[0]-a[0])*t,y+a[1]+(b[1]-a[1])*t,.045,.065,color,.08,.58);}
      }
    }
    return {member,arc,window,label,length};
  }

  // The old v183 length<3m filter omitted every small curved risalit segment.
  // Add each exact missing plane, with the same documented upper-skin height.
  for(const face of source.missingCourtFaces) {
    const f=facade(face),bottom=Math.max(3,face.top),top=source.courtSkinTop;
    f.member(f.length/2,(bottom+top)/2,f.length,top-bottom,STONE,.08,.01);
    for(const y of [8,18,26.7]) f.member(f.length/2,y,f.length,.18,LIGHT,.2,.2);
  }
  // Surviving Littenstraße giant order and curved entrance crown. Proportions
  // follow the LDA exterior; no vanished Grunerstraße towers are introduced.
  const portal=facade({a:[2831.19,64.936],b:[2852.527,100.287],normal:[-.856,.517],contour:source.courtFront});
  const center=portal.length/2;
  for(const u of [4,12,15,portal.length-15,portal.length-12,portal.length-4]) {
    portal.member(u,15.1,.62,21.8,LIGHT,.34,1.0);
    for(const yy of [4.3,8.2,23.8,25.0]) {
      portal.member(u,yy,1.12,.3,STONE,.45,1.04);
      portal.member(u,yy+.23,1.45,.18,LIGHT,.5,1.08);
    }
    for(const offset of [-.16,.16]) portal.member(u+offset,15,.055,13.8,DARK,.06,1.19);
  }
  for(const [u,w] of [[center,10.4],[7.8,5.5],[portal.length-7.8,5.5]]) {
    portal.window(u,17.2,w-1,12.3);
    portal.arc(u,23.4,w,3.1,LIGHT,.25,.75);
    portal.arc(u,23.9,w+1.1,3.8,STONE,.28,.62);
  }
  portal.arc(center,27.2,15,2.4,LIGHT,.25,.7);
  portal.arc(center,27.55,15.9,2.6,DARK,.15,.63);
  for(const side of [-1,1]) {
    const u=center+side*4.1;
    portal.member(u,7.5,.72,8.1,STONE,.6,1.35);
    portal.member(u,3.5,1.1,.6,DARK,.75,1.4);
    portal.member(u,11.4,1.45,.32,LIGHT,.7,1.4);
    portal.member(u,12.5,.4,1.5,LIGHT,.45,1.4);
    portal.arc(u,13.2,1.1,.65,LIGHT,.17,1.45);
  }
  portal.member(center,6.1,6.4,6.0,0x64533a,.08,.74);
  for(let i=-4;i<=4;i++) portal.member(center+i*.65,6.2,.08,5.5,0xb5a16b,.08,.88);
  portal.arc(center,8.9,7.9,2.8,LIGHT,.28,1.2);
  portal.arc(center,11.7,9.1,1.5,LIGHT,.3,1.2);
  for(const face of source.missingCourtFaces.filter(f=>f.a[0]<2878&&f.b[0]<2878)) {
    const f=facade(face);
    for(const y of [3.6,4.4,5.2,6.0,6.8,7.6]) f.member(f.length/2,y,f.length,.055,DARK,.1,.2);
  }

  // Waisenstraße's measured row remains intact. Current operator colours win
  // over the older LDA photograph's green sign and shutters.
  for(const [index,face] of source.restaurants.entries()) {
    const f=facade(face),central=index===0,cols=central?4:2;
    const trim=central?0xdfd9c7:0xd2b387,wood=central?0x6b4833:0xeee4cf;
    for(const y of [3.3,6.1,9.1,12.0]) if(y<face.top) f.member(f.length/2,y,f.length,.14,trim,.18,.24);
    for(let c=0;c<cols;c++) {
      const u=f.length*(c+.5)/cols;
      for(const y of [4.6,7.65,10.65]) {
        f.window(u,y,central?1.35:1.55,1.8,wood);
        if(y===4.6) for(const side of [-1,1]) {
          f.member(u+side*(central?1.0:1.15),y,.46,1.9,0xb98c50,.13,.45);
          for(let slat=0;slat<8;slat++) f.member(u+side*(central?1.0:1.15),y-.8+slat*.22,.42,.035,0x795937,.06,.54);
        }
      }
      if(central) f.member(u,8.85,1.6,.16,trim,.28,.42);
    }
    if(central) {
      f.member(f.length/2,6.35,f.length-.45,.85,0x865332,.13,.42);
      f.label("ZUR LETZTEN INSTANZ",f.length/2,6.35,.27,0xe2c48a);
      const door=f.length*.625;
      f.member(door,4.45,1.55,2.8,0x55402c,.08,.47);
      f.member(door,5.7,1.4,.4,GLASS,.08,.5);
      for(const x of [-.81,.81]) f.member(door+x,4.45,.11,2.95,0xc69853,.16,.59);
      for(const x of [door-1.2,door+1.2]) {
        f.member(x,5.8,.07,.95,IRON,.35,.65);
        f.member(x,6.0,.28,.56,0xe4bb70,.22,.78);
        for(const y of [5.7,6.3]) f.member(x,y,.36,.09,IRON,.32,.8);
        for(const xx of [-.14,.14]) f.member(x+xx,6,.04,.62,IRON,.28,.82);
      }
      for(const u of [f.length*.2,f.length*.5,f.length*.8]) {
        f.window(u,13.7,.9,1.55,wood);
        f.member(u,14.55,1.12,.13,wood,.3,.5);
      }
      for(let step=0;step<2;step++) f.member(door,3.08+step*.14,2.4-step*.2,.14,0xaba99b,.5-step*.08,.7-step*.15);
    }
  }
  return rows;
}
