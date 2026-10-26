/** Offline inspection of actual constructed matrices + retained primary packets. */
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {Color,InstancedMesh,Matrix4,Vector3} from 'three';
import {planHerzJesuV274,planGroberUnfugV274} from '../src/NorthCultureV274';
import {createSuhrkampPfefferbergV189} from '../src/SuhrkampPfefferbergV189';
import old from '../src/data/suhrkampPfefferbergV189.json';
import {createAlexanderNorthV166,createMinecraftAlexanderNorthV166} from '../src/AlexanderNorthV166';
const dir=join(homedir(),'.cache/codex-berlin-v274');mkdirSync(dir,{recursive:true});
const corners=[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,.5,-.5],[-.5,.5,-.5],[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]];
const faces=[[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]];
type Scene={name:string;native:boolean;view:number[];polys:number[][][];colors:number[][]};
const scenes:Scene[]=[];
function batch(scene:Scene,mesh:InstancedMesh,indices?:number[]){
  const m=new Matrix4(), c=new Color();
  for(const i of indices??Array.from({length:mesh.count},(_,i)=>i)){
    mesh.getMatrixAt(i,m);mesh.getColorAt(i,c);
    const ps=corners.map(v=>new Vector3(...v as [number,number,number]).applyMatrix4(m).toArray());
    for(const f of faces){scene.polys.push(f.map(k=>ps[k]));scene.colors.push(c.clone().convertLinearToSRGB().toArray());}
  }
  mesh.geometry.dispose();mesh.userData.dayMaterial?.dispose();mesh.userData.nightMaterial?.dispose();
}
function packet(scene:Scene,tile:string,bounds:number[]){
  const data=JSON.parse(gunzipSync(readFileSync(new URL(`../public/mesh/surrounding-berlin-v159/${tile}.${scene.native?'minecraft':'drawn'}.json.gz`,import.meta.url))).toString());
  for(const mesh of data.meshes.filter((m:{kind:string})=>m.kind==='city')){
  const ps=Buffer.from(mesh.positions,'base64'),cs=Buffer.from(mesh.colors,'base64'),ix=Buffer.from(mesh.indices,'base64');
  for(let i=0;i<ix.length;i+=12){
    const ids=[0,4,8].map(k=>ix.readUInt32LE(i+k));
    const points=ids.map(k=>[0,1,2].map(j=>data.origin[j]+ps.readUInt16LE(k*6+j*2)/100));
    const x=points.reduce((s,p)=>s+p[0],0)/3,z=points.reduce((s,p)=>s+p[2],0)/3;
    if(x<bounds[0]||x>bounds[1]||z<bounds[2]||z>bounds[3])continue;
    scene.polys.push(points);scene.colors.push([0,1,2].map(k=>cs[ids[0]*3+k]/255));
  }
  }
}
for(const native of [false,true]){
  let scene:Scene={name:'Herz Jesu',native,view:[.65,.35,-1],polys:[],colors:[]};
  packet(scene,'5_-3',[2590,2640,-1281,-1230]);batch(scene,planHerzJesuV274(native).mesh('preview'));scenes.push(scene);
  scene={name:'Grober Unfug',native,view:[.4,.30,1],polys:[],colors:[]};
  packet(scene,'4_-3',[2428,2460,-1133,-1113]);batch(scene,planGroberUnfugV274(native).mesh('preview'));scenes.push(scene);
  scene={name:'Schönhauser Tor',native,view:[-1,.4,1],polys:[],colors:[]};
  const tor=native?createMinecraftAlexanderNorthV166():createAlexanderNorthV166();
  tor.traverse(o=>{
    if(o instanceof InstancedMesh){const indices=[];for(let i=0;i<o.count;i++){const x=o.instanceMatrix.array[i*16+12],z=o.instanceMatrix.array[i*16+14];if(x>2630&&x<2710&&z>-1120&&z<-1020)indices.push(i)}batch(scene,o,indices)}
    else if('geometry' in o){const geo=(o as any).geometry,ps=geo.getAttribute('position'),cs=geo.getAttribute('color');if(!ps)return;for(let i=0;i<ps.count;i+=3){const points=[0,1,2].map(k=>[ps.getX(i+k),ps.getY(i+k),ps.getZ(i+k)]),p=points[0];if(p[0]>2630&&p[0]<2710&&p[2]>-1120&&p[2]<-1020){scene.polys.push(points);scene.colors.push(new Color(cs.getX(i),cs.getY(i),cs.getZ(i)).convertLinearToSRGB().toArray())}}geo.dispose();}
  });scenes.push(scene);
  scene={name:'Suhrkamp · west glass flanks',native,view:[-1,.28,.05],polys:[],colors:[]};
  const root=createSuhrkampPfefferbergV189(native),mesh=root.children[0] as InstancedMesh;
  const selected=mesh.userData.sourceFaceRanges.filter((r:{faceIndex:number})=>old.faces[r.faceIndex].normal[0]<-.9&&old.faces[r.faceIndex].kind==='suhrkamp').flatMap((r:{first:number;count:number})=>Array.from({length:r.count},(_,i)=>r.first+i));
  batch(scene,mesh,selected);(root.children[1] as InstancedMesh).geometry.dispose();scenes.push(scene);
}
writeFileSync(join(dir,'north-culture-actual-matrices.json'),JSON.stringify(scenes));
console.log(join(dir,'north-culture-actual-matrices.json'));
