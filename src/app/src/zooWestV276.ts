import data from './data/zooWestV276.json';
import old from './data/zooGroundsV165Source.json';
import type { ZooRecognitionV255Sink } from './ZooRecognitionV255';
import { letteringStrokePaths } from './drawnLettering';

type P = [number, number, number];

/** Join only exactly touching, equal-section/equal-colour orthogonal boxes.
 * No snapping, overlapping merge, sampling or changed occupied volume. */
export function compactZooWestV276Rows(rows: readonly number[][]): number[][] {
  const groups = new Map<string, number[][]>();
  for (const row of rows) {
    if (row[6] !== 0) throw new Error('Zoo compaction requires independent orthogonal rows');
    const key = [row[0], row[1], row[3], row[4], row[6], row[7]].join(':');
    const list = groups.get(key) ?? []; list.push(row); groups.set(key, list);
  }
  const result: number[][] = [];
  for (const group of groups.values()) {
    group.sort((a, b) => (a[2] - a[5] / 2) - (b[2] - b[5] / 2));
    let pending: number[] | null = null;
    for (const row of group) {
      if (pending && pending[2] + pending[5] / 2 === row[2] - row[5] / 2) {
        const start = pending[2] - pending[5] / 2, end = row[2] + row[5] / 2;
        pending[2] = (start + end) / 2; pending[5] = end - start;
      } else { if (pending) result.push(pending); pending = row.slice(); }
    }
    if (pending) result.push(pending);
  }
  return result;
}

function rows(d: ZooRecognitionV255Sink, records: readonly number[][]): void {
  for (const r of records) d.box(r[7],r[0],r[1],r[2],r[3],r[4],r[5],r[6]);
}

function sign(d: ZooRecognitionV255Sink, text: string, x: number, y: number, z: number, yaw: number, width: number): void {
  const paths=letteringStrokePaths(text,.48), extent=Math.max(...paths.flatMap(p=>p.map(v=>v[0])));
  const scale=Math.min(1,width/extent);
  for(const path of paths)for(let i=1;i<path.length;i++){
    const at=(p:number[]):P=>{const u=(p[0]-extent/2)*scale;return[x+Math.cos(yaw)*u,y+p[1]*scale,z-Math.sin(yaw)*u];};
    const a=at(path[i-1]),b=at(path[i]);
    if(d.native){const n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[2]-a[2])/.3));for(let j=0;j<n;j++){const t=(j+.5)/n;d.box(0xE2DBC3,a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t,Math.max(.055,Math.abs(b[0]-a[0])/n),Math.max(.055,Math.abs(b[1]-a[1])),Math.max(.055,Math.abs(b[2]-a[2])/n));}}
    else d.line(0xE2DBC3,a,b,.055);
  }
}

function restaurants(d: ZooRecognitionV255Sink): void {
  if(d.native) rows(d,compactZooWestV276Rows(data.nativeRows));
  else for(const surface of data.surfaces)for(const tri of surface.triangles)d.face(surface.color,tri as P[]);
  for(const part of data.parts)rows(d,part.posts);
  const cells=data.parts.flatMap(p=>p.nativeCells.map(([x,z,y])=>({x,z,y,bottom:p.openCanopy?y-.2:5.2})));
  for(const f of data.fittings){
    const [x,z]=f.a,[tx,tz]=f.t,[nx,nz]=f.n,h=f.top-f.base,y=(f.top+f.base)/2,yaw=Math.atan2(-tz,tx);
    const box=(u:number,cy:number,w:number,hh:number,depth:number,c:number)=>{
      if(!d.native){d.box(c,x+tx*u+nx*.065,cy,z+tz*u+nz*.065,w,hh,depth,yaw);return;}
      // Fit to every actual replacement cell, not its smooth wall or AABB.
      const n=Math.max(1,Math.ceil(w/.55));
      for(let i=0;i<n;i++){
        const v=u-w/2+(i+.5)*w/n,ww=Math.abs(tx)*w/n+Math.abs(nx)*depth,dd=Math.abs(tz)*w/n+Math.abs(nz)*depth;
        for(let off=.15;off<=1.75;off+=.1){
          const xx=x+tx*v+nx*off,zz=z+tz*v+nz*off;
          if(cells.some(p=>xx+ww/2>p.x+1e-5&&xx-ww/2<p.x+1-1e-5&&zz+dd/2>p.z+1e-5&&zz-dd/2<p.z+1-1e-5&&cy+hh/2>p.bottom&&cy-hh/2<p.y))continue;
          d.box(c,xx,cy,zz,ww,hh,dd);break;
        }
      }
    };
    box(0,y,f.width,h,.055,0x536C68);
    for(const u of [-f.width/2,0,f.width/2])box(u,y,.07,h+.12,.09,f.color);
    for(const cy of [f.base,f.top])box(0,cy,f.width+.1,.09,.09,f.color);
  }
  // The labels use the measured southwest facades, with a separate native
  // offset outside the actual one-metre columns. No entrance is invented.
  for(const [id,aa,bb,text,width,cy] of [['AQtqSLil',12,14,'WALDSCHÄNKE',5.8,8.7],['25396899',5,6,'ZOO TALIA',6.5,8.85]] as const){
    const part=data.parts.find(p=>p.sourceId===id)!,a=part.ring[aa],b=part.ring[bb];
    const length=Math.hypot(b[0]-a[0],b[1]-a[1]),tx=(b[0]-a[0])/length,tz=(b[1]-a[1])/length;
    const out=d.native?1.35:.13,x=(a[0]+b[0])/2+tz*out,z=(a[1]+b[1])/2-tx*out,yaw=Math.atan2(-tz,tx);
    d.box(id==='25396899'?0x59654C:0x71553C,x,cy,z,width,.8,.13,yaw);
    sign(d,text,x+tz*.09,cy-.23,z-tx*.09,yaw,width-.3);
  }
}

function wolf(d: ZooRecognitionV255Sink,x:number,z:number,yaw:number):void{
  const at=(u:number,h:number,v:number):P=>[x+Math.cos(yaw)*u+Math.sin(yaw)*v,5.32+h,z-Math.sin(yaw)*u+Math.cos(yaw)*v];
  // Natural-size Eurasian wolf: long muzzle, upright ears, low bushy tail;
  // pale grey-buff coat with dark saddle, not a white arctic-wolf assertion.
  const b=(c:number,u:number,h:number,v:number,w:number,hh:number,dep:number)=>d.box(c,...at(u,h,v),w,hh,dep,d.native?0:yaw);
  b(0xB4AD91,0,.65,0,1.05,.40,.35);b(0x66695E,-.08,.87,0,.8,.13,.31);
  b(0xC8C2AD,.44,.80,0,.32,.52,.33);b(0xBEB79E,.64,1.01,0,.34,.29,.27);
  b(0xC8C2AD,.87,.94,0,.35,.15,.18);b(0x30372E,1.04,.95,0,.07,.1,.15);
  for(const v of[-.12,.12]){b(0x7D7D68,.59,1.24,v,.13,.25,.09);b(0x242D25,.75,1.06,v*1.12,.035,.045,.035);}
  for(const u of[-.37,.36])for(const v of[-.14,.14]){b(0xC3BCA6,u,.29,v,.115,.55,.12);b(0xCAC4AF,u+.05,.035,v,.21,.07,.14);}
  for(let i=0;i<3;i++)b(0x939781,-.63-i*.14,.59-i*.12,0,.26,.2,.23-i*.035);
}

function condorDetails(d:ZooRecognitionV255Sink):void{
  const profile=old.parts.find(p=>p.osm==='32995989')!;
  const cx=profile.ring.reduce((s,p)=>s+p[0],0)/profile.ring.length,cz=profile.ring.reduce((s,p)=>s+p[1],0)/profile.ring.length;
  for(const [dx,dz,yaw] of[[-4,-1,.4],[4,5,2.1]]){
    const x=cx+dx,z=cz+dz,at=(u:number,h:number,v:number):P=>[x+Math.cos(yaw)*u+Math.sin(yaw)*v,8.2+h,z-Math.sin(yaw)*u+Math.cos(yaw)*v];
    d.box(0xB6AC91,...at(.65,.38,0),.18,.1,.12,d.native?0:yaw); // hooked pale bill
    d.box(0xCABFA2,...at(.39,.51,0),.14,.07,.13,d.native?0:yaw); // male comb
    for(const side of[-1,1]){
      for(let i=0;i<4;i++){
        const v=side*(.35+i*.26),u=-.15-i*.09;
        if(d.native)d.box(i<3?0xE2DED0:0x262C29,...at(u,.19,v),.62,.09,.28);
        else d.face(i<3?0xE2DED0:0x262C29,[at(u-.35,.18,v-side*.16),at(u+.24,.23,v-side*.16),at(u+.16,.20,v+side*.16),at(u-.42,.14,v+side*.16)]);
      }
      d.box(0x8D8A74,...at(-.1,-.05,side*.13),.075,.26,.07);
      d.box(0x8D8A74,...at(.02,-.16,side*.13),.3,.055,.095);
    }
  }
}

function aviaryBracing(d:ZooRecognitionV255Sink):void{
  for(const id of['32995989','32995991']){
    const p=old.parts.find(p=>p.osm===id)!;
    const edges=new Map<string,[P,P]>();
    for(const s of old.surfaces.filter(s=>s.partId===p.id&&s.kind==='RoofSurface'))for(const tri of s.triangles)for(let i=0;i<3;i++){
      const a=tri[i] as P,b=tri[(i+1)%3] as P,key=[a.join(','),b.join(',')].sort().join(';');edges.set(key,[a,b]);
    }
    // Exact retained roof ridges and structural perimeter; no invented new dome.
    for(const [a,b] of edges.values()){
      if(d.native){const count=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[2]-a[2])/2));for(let i=0;i<count;i++){const t=(i+.5)/count;d.box(0x647165,a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t,Math.max(.1,Math.abs(b[0]-a[0])/count),Math.max(.1,Math.abs(b[1]-a[1])/count),Math.max(.1,Math.abs(b[2]-a[2])/count));}}
      else d.line(0x647165,a,b,.10);
    }
  }
}

export function appendZooWestV276(d:ZooRecognitionV255Sink):void{
  restaurants(d);aviaryBracing(d);condorDetails(d);
  for(const [x,z,yaw] of data.wolves)wolf(d,x,z,yaw);
  for(const [x,z]of data.shrubs){
    if(d.native){d.box(0x526F44,x,5.9,z,2.1,1.2,2.1);d.box(0x607A4A,x,6.65,z,1.5,.6,1.5);}
    else for(let i=0;i<8;i++){const a=i*Math.PI/4,b=(i+1)*Math.PI/4;d.face(i%2?0x607A4A:0x526F44,[[x+Math.cos(a)*1.25,5.4,z+Math.sin(a)*1.25],[x+Math.cos(b)*1.25,5.4,z+Math.sin(b)*1.25],[x+Math.cos(b)*.85,6.7,z+Math.sin(b)*.85],[x+Math.cos(a)*.85,6.7,z+Math.sin(a)*.85]]);d.face(0x6B824E,[[x+Math.cos(a)*.85,6.7,z+Math.sin(a)*.85],[x+Math.cos(b)*.85,6.7,z+Math.sin(b)*.85],[x,7,z]]);}
  }
}
