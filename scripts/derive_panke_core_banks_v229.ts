/** Retain the exact existing curved-bank construction and its landward datum. */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {densifyRing} from '../src/app/src/bankCurves';
import {smoothGroundTopSampler} from '../src/app/src/terrainPayload';
const surfacePath='src/app/public/mesh/regierungsviertel/surface-polygons.json',groundPath='src/app/public/mesh/regierungsviertel/ground-context.json';
const surfaces=JSON.parse(readFileSync(surfacePath,'utf8')),ground=JSON.parse(readFileSync(groundPath,'utf8'));
const selected=[24,35,41,42,43,50,54,66,68,72,73,84,90,100,114],sample=smoothGroundTopSampler(ground);
const top=(x:number,z:number)=>Math.max(ground.water_top_y_m+5.35-.8,sample(x/ground.cell_m-ground.grid.min_x_idx,z/ground.cell_m-ground.grid.min_z_idx))+.12;
const records=[];
for(const index of selected) {
 const surface=surfaces.water[index];if(surface.area_m2<400)continue;
 const ring=densifyRing(surface.ring.map(([x,z]:number[])=>[x/10,z/10]),{cornerDeg:68,maxSegmentM:2.5});
 const area=ring.reduce((v,a,i)=>{const b=ring[(i+1)%ring.length];return v+a[0]*b[1]-b[0]*a[1]},0),out=area>0?1:-1;
 for(let i=0;i<ring.length;i++){
  const a=ring[i],b=ring[(i+1)%ring.length],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz);if(l<.2)continue;
  const nx=-dz/l*out,nz=dx/l*out;
  records.push({index,a,b,normal:[nx,nz],tops:[top(a[0]-nx*1.2,a[1]-nz*1.2),top(b[0]-nx*1.2,b[1]-nz*1.2)]});
 }
}
writeFileSync('geo_data/regierungsviertel/panke-core-banks-v229.json',JSON.stringify({sha256:Object.fromEntries([surfacePath,groundPath].map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')])),selected,records})+'\n');
