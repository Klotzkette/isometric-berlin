/** Exact mapped hardscape, painted on its original terrain without new geometry. */
import { Color, InstancedMesh, Material, Mesh, type Object3D } from 'three';
import source from './data/hbfForecourtFinishV354.json';
import { isSceneMaterialProgramRetirementV321 } from './sceneMaterialPrograms';
import { registerGroundRangeShaderWrapperV383 } from './groundRangeShaderProvenanceV383';

const CONTROL = 2767908831;
const TAG = 'hbfForecourtFinishV354';
type Polygon = {ring:number[][];holes:number[][][]};
type Binding = {native:boolean;dead:boolean};
const bindings = new WeakMap<Material, Binding>();
function control(value:unknown):number {
  let h=2166136261;for(const c of JSON.stringify(value))h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h;
}
const trusted = control(source) === CONTROL;
const polygons = [source.drawn,source.native] as Polygon[][];
const number = (n:number) => Number.isInteger(n)?`${n}.0`:String(n);
const vec2 = (p:number[]) => `vec2(${p.map(number).join(',')})`;

function inRing(ring:number[][],x:number,z:number):boolean {
  let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i],b=ring[j];
    if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }return inside;
}
/** Same complete rings and holes as the shader; Native comprises only fully
 * contained original 4m cells, independently admitted rather than rounded. */
export function hbfForecourtPavedAtV354(x:number,z:number,native=false):boolean {
  return trusted&&Number.isFinite(x)&&Number.isFinite(z)&&polygons[+native].some(p=>inRing(p.ring,x,z)&&!p.holes.some(h=>inRing(h,x,z)));
}

/** Factory-only scalar provenance survives Worker transfer. The two retained
 * constructor names and the original instance buffers are required together. */
export function markHbfForecourtFinishV354(mesh:Mesh,native=false):boolean {
  if(!trusted||!(mesh instanceof InstancedMesh)||!mesh.instanceColor||mesh.count<1||
    mesh.name!==(native?'Voxel ground runs':'Drawn ground slabs'))return false;
  mesh.userData[TAG]=native?'native-source-ground':'drawn-source-ground';return true;
}

const VARYING='varying vec3 vForecourtWorldV354;\nvarying vec3 vForecourtPaintV354;\n';
function maskShader(native:boolean):string {
  let index=0;const functions:string[]=[],families:string[]=[];
  for(const p of polygons[+native]){
    const rings=[p.ring,...p.holes].map(r=>{
      // Closing duplicate is immaterial to the complete ray-crossing course.
      const q=r.slice(0,-1),name=`forecourtRingV354_${index++}`;
      functions.push(`bool ${name}(vec2 p){\nconst vec2 r[${q.length}]=vec2[${q.length}](${q.map(vec2).join(',')});\nbool hit=false;int j=${q.length-1};for(int i=0;i<${q.length};i++){vec2 a=r[i],b=r[j];if((a.y>p.y)!=(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)hit=!hit;j=i;}return hit;}`);
      return `${name}(p)`;
    });
    const xs=p.ring.map(q=>q[0]),zs=p.ring.map(q=>q[1]);
    families.push(`(p.x>=${number(Math.min(...xs))}&&p.x<=${number(Math.max(...xs))}&&p.y>=${number(Math.min(...zs))}&&p.y<=${number(Math.max(...zs))}&&${rings[0]}${rings.slice(1).map(r=>'&&!'+r).join('')})`);
  }
  const shades=native?[0x74b043,0x5d9634,0x994a35,0x715b4a]:[0xb9d9aa,0xbadaab,0xb8d8a9,0xf0d6bb,0xedcfb2];
  const colours=shades.map(hex=>new Color(hex).toArray());
  const admitted=colours.map(c=>`distance(vForecourtPaintV354,vec3(${c.map(number).join(',')}))<.00001`).join('||');
  const colour=new Color(native?0xaaa9a1:0xbab8b1).toArray();
  const b=source.bounds;
  return `${VARYING}\n${functions.join('\n')}\nvec3 forecourtFinishV354(vec3 paint){
  vec2 p=vForecourtWorldV354.xz;
  // All polygon work is after this tiny, fixed station-local bounding test.
  if(p.x<${number(b[0])}||p.x>${number(b[2])}||p.y<${number(b[1])}||p.y>${number(b[3])})return paint;
  if(!(${admitted}))return paint;
  vec3 n=cross(dFdx(vForecourtWorldV354),dFdy(vForecourtWorldV354));
  if(abs(n.y)<length(n)*.9)return paint;
  if(!(${families.join('||')}))return paint;
  return vec3(${colour.map(number).join(',')});
}`;
}
const shaders=new Map<boolean,string>();
export function patchHbfForecourtShaderV354(vertex:string,fragment:string,native=false):{vertex:string;fragment:string} {
  if(!trusted)return{vertex,fragment};
  if(vertex.includes('vForecourtWorldV354')||fragment.includes('forecourtFinishV354'))return{vertex,fragment};
  if(!vertex.includes('#include <project_vertex>')||!vertex.includes('#include <color_vertex>')||!fragment.includes('#include <color_fragment>'))throw Error('Unsupported forecourt ground shader V354');
  let shader=shaders.get(native);if(!shader){shader=maskShader(native);shaders.set(native,shader);}
  vertex=VARYING+vertex.replace('#include <project_vertex>',`vec4 forecourtPositionV354=vec4(transformed,1.);
#ifdef USE_BATCHING
forecourtPositionV354=batchingMatrix*forecourtPositionV354;
#endif
#ifdef USE_INSTANCING
forecourtPositionV354=instanceMatrix*forecourtPositionV354;
#endif
vForecourtWorldV354=(modelMatrix*forecourtPositionV354).xyz;
#include <project_vertex>`).replace('#include <color_vertex>',`#include <color_vertex>
vForecourtPaintV354=vec3(1.);
#if defined(USE_COLOR)||defined(USE_COLOR_ALPHA)||defined(USE_INSTANCING_COLOR)||defined(USE_BATCHING_COLOR)
vForecourtPaintV354=vColor.rgb;
#endif`);
  const prior='diffuseColor.rgb=groundFinishV348(diffuseColor.rgb);';
  const anchor=fragment.includes(prior)?prior:'#include <color_fragment>';
  fragment=shader+'\n'+fragment.replace(anchor,anchor+'\ndiffuseColor.rgb=forecourtFinishV354(diffuseColor.rgb);');
  return{vertex,fragment};
}
function install(material:Material,native:boolean):boolean {
  if(bindings.has(material)||!['MeshBasicMaterial','MeshStandardMaterial','MeshLambertMaterial','MeshPhongMaterial','MeshToonMaterial'].includes(material.type))return false;
  const previous=material.onBeforeCompile,key=material.customProgramCacheKey();
  const binding={native,dead:false};bindings.set(material,binding);
  material.onBeforeCompile=function(shader,renderer){
    previous.call(this,shader,renderer);if(binding.dead)return;
    const next=patchHbfForecourtShaderV354(shader.vertexShader,shader.fragmentShader,native);
    shader.vertexShader=next.vertex;shader.fragmentShader=next.fragment;
  };
  registerGroundRangeShaderWrapperV383(previous, material.onBeforeCompile);
  material.customProgramCacheKey=()=>key+'|hbf-forecourt-v354-'+(native?'native':'drawn');
  material.addEventListener('dispose',()=>{if(!isSceneMaterialProgramRetirementV321(material))binding.dead=true;});
  material.needsUpdate=true;return true;
}
export function inheritHbfForecourtFinishV354(source:Material,target:Material):boolean {
  const binding=bindings.get(source);return!!binding&&!binding.dead&&install(target,binding.native);
}
/** Attach/mode-time only. No geometry writes, animation, textures or traversal
 * in the frame loop. Authored plazas, grove ground and all buildings are absent. */
export function bindHbfForecourtFinishV354(root:Object3D):number {
  if(!trusted)return 0;let changed=0;
  root.traverse(object=>{
    if(!(object instanceof InstancedMesh)||!object.instanceColor)return;
    const tag=object.userData[TAG];if(tag!=='native-source-ground'&&tag!=='drawn-source-ground')return;
    if(object.name!==(tag==='native-source-ground'?'Voxel ground runs':'Drawn ground slabs'))return;
    const seen=new Set<Material>();
    for(const value of [object.userData.dayMaterial,object.userData.nightMaterial,object.userData.moonlitMaterial,object.userData.schwellenraumMaterial,object.material])for(const material of Array.isArray(value)?value:[value]){
      if(!(material instanceof Material)||seen.has(material))continue;seen.add(material);changed+=+install(material,tag==='native-source-ground');
    }
  });return changed;
}
