/** Presentation only: explicit source-ground roles, no source paint or topology edits. */
import { Color, Material, Mesh, Vector4, type Object3D } from 'three';
import type { SurroundingCityChunk } from './SurroundingCityGeometry';
import { isSceneMaterialProgramRetirementV321 } from './sceneMaterialPrograms';

export type GroundFinishKindV348 = 'asphalt' | 'paving' | 'grass' | 'core-drawn' | 'core-native';
type Role = 1 | 2 | 3 | 4; // asphalt, paving, grass, unspecified mapped path
export type GroundFinishPartSpanV348 = { kind: string; indexStart: number; indexCount: number };
type Selector = Readonly<{ colour: readonly number[]; y: number; role: Role }>;
export type GroundFinishPacketV348 = Readonly<{ selectors: readonly Selector[]; triangles: number }>;
const certificates = new WeakSet<GroundFinishPacketV348>();
const packetMeshes = new WeakMap<Mesh, GroundFinishPacketV348>();
const KEY = 'groundFinishV348';
const ROLES = { asphalt: 1, paving: 2, grass: 3 } as const;
const validKinds = new Set<string>(['asphalt', 'paving', 'grass', 'core-drawn', 'core-native']);
const linear = (rgb: readonly number[]) => rgb.map(v => {
  const c = v / 255;
  return Math.round((c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4) * 255) / 255;
});
// These are the semantic emissions in build_surrounding_outlines.py, not
// inferred building/ground colours. The complete final triangles are checked.
const LEGACY_ROLES: readonly Selector[] = Object.freeze(([
  { colour: Object.freeze(linear([109, 112, 109])), y: 3.09, role: 1 },
  { colour: Object.freeze(linear([124, 160, 105])), y: 3.01, role: 3 },
  { colour: Object.freeze(linear([201, 190, 162])), y: 3.12, role: 4 },
] as Selector[]).map(s => Object.freeze(s)));

/** Factory-only semantic tag survives the existing Worker transport. Native
 * is deliberately admitted as a no-op: its independent block palette stays exact. */
export function markGroundFinishV348(mesh: Mesh, kind: GroundFinishKindV348): void {
  if (validKinds.has(kind)) mesh.userData[KEY] = kind;
}

/** No allocations proportional to geometry. Only original city source parts
 * qualify. Any partial, sloping, other-part or unsupported colour/height match
 * rejects that complete role; it can never leak onto a roof or authored pattern.
 * The bounded navigation probe is an additional guard, not a replacement source. */
export function* certifyPacketGroundFinishV348Steps(
  chunk: SurroundingCityChunk, vertices: Uint16Array, indices: Uint16Array | Uint32Array,
  spans: readonly GroundFinishPartSpanV348[],
): Generator<void, GroundFinishPacketV348 | null> {
  if (chunk.nav.groundY !== 3 || !chunk.origin.every(Number.isFinite) || vertices.length % 6 ||
      indices.length % 3 || spans.length !== chunk.meshes.length || spans.length > 16) return null;
  let end = 0;
  for (let i = 0; i < spans.length; i++) {
    const s = spans[i];
    if (s.kind !== chunk.meshes[i].kind || s.indexStart !== end || s.indexCount < 0 || s.indexCount % 3) return null;
    end += s.indexCount;
  }
  if (end !== indices.length) return null;
  const polygons = chunk.nav.ground;
  if (!polygons.length || polygons.length > 256) return null;
  let sourcePoints = 0;
  const bounds: number[][] = [];
  for (const p of polygons) {
    sourcePoints += p.ring.length + p.holes.reduce((n,h) => n + h.length, 0);
    if (sourcePoints > 8192) return null;
    let x0=Infinity,z0=Infinity,x1=-Infinity,z1=-Infinity;
    for (const [x,z] of p.ring) { x0=Math.min(x0,x);z0=Math.min(z0,z);x1=Math.max(x1,x);z1=Math.max(z1,z); }
    bounds.push([x0,z0,x1,z1]);
  }
  let probes = 0;
  const insideRing = (ring: number[][], x: number, z: number): boolean => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      if (++probes > 262144) return false;
      const a = ring[i], b = ring[j];
      if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  };
  const supported = (x: number, z: number) => polygons.some((p, i) => {
    const b = bounds[i];
    return x >= b[0] && x <= b[2] && z >= b[1] && z <= b[3] && insideRing(p.ring, x, z) &&
      !p.holes.some(h => insideRing(h, x, z));
  });
  const count = [0, 0, 0], rejected = [false, false, false];
  let part = 0;
  for (let at = 0; at < indices.length; at += 3) {
    if (at % 12288 === 0) yield;
    while (part < spans.length && at >= spans[part].indexStart + spans[part].indexCount) part++;
    const a = indices[at] * 6, b = indices[at + 1] * 6, c = indices[at + 2] * 6;
    if ([a,b,c].some(i => i < 0 || i + 5 >= vertices.length) || part >= spans.length) return null;
    if (a === b || b === c || a === c) continue; // existing source-owner retirement
    for (let r = 0; r < LEGACY_ROLES.length; r++) {
      if (rejected[r]) continue;
      const s = LEGACY_ROLES[r], y = Math.round((s.y - chunk.origin[1]) * 100);
      const matches = (i: number) => vertices[i+1] === y && s.colour.every((v,k) => vertices[i+3+k] === Math.round(v * 65535));
      const n = +matches(a) + +matches(b) + +matches(c);
      if (!n) continue;
      const area = (vertices[b] - vertices[a]) * (vertices[c+2] - vertices[a+2]) -
        (vertices[c] - vertices[a]) * (vertices[b+2] - vertices[a+2]);
      if (n !== 3 || spans[part].kind !== 'city' || area === 0 ||
          !supported((vertices[a]+vertices[b]+vertices[c])/300, (vertices[a+2]+vertices[b+2]+vertices[c+2])/300)) rejected[r] = true;
      else count[r]++;
    }
  }
  if (probes > 262144) return null;
  const selectors = LEGACY_ROLES.filter((_,r) => count[r] > 0 && !rejected[r]);
  if (!selectors.length) return null;
  const proof = Object.freeze({ selectors: Object.freeze(selectors), triangles: count.reduce((n,v,r) => n + (rejected[r] ? 0 : v), 0) });
  certificates.add(proof);
  return proof;
}

export function markPacketGroundFinishV348(mesh: Mesh, proof: GroundFinishPacketV348): boolean {
  if (!certificates.has(proof)) return false;
  packetMeshes.set(mesh, proof);
  return true;
}

type Spec = { kind: GroundFinishKindV348 | 'packet'; selectors: readonly Selector[]; night: boolean };
type Binding = { spec: Spec; dead: boolean };
const bound = new WeakMap<Material, Binding>();
const coreSelectors: readonly Selector[] = Object.freeze(([
  [1, [0xc3c8c3, 0xc6cbc5]], [2, [0xf0d6bb, 0xedcfb2]], [3, [0xb9d9aa, 0xbadaab, 0xb8d8a9]],
] as const).flatMap(([role, shades]) => shades.map(hex => {
  const c = new Color(hex);
  return Object.freeze({ colour: Object.freeze([c.r,c.g,c.b]), y: -999, role });
})));

const VARYINGS = 'varying vec3 vGroundWorldV348;\nvarying vec3 vGroundPaintV348;\n';
export const GROUND_FINISH_GLSL_V348 = `
${VARYINGS}
uniform vec4 uGroundSelectorsV348[8];
uniform float uGroundRolesV348[8];
uniform float uGroundKindV348;
uniform float uGroundNightV348;
float groundHashV348(vec2 p) {
 vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);
}
float groundNoiseV348(vec2 p) {
 vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(groundHashV348(i),groundHashV348(i+vec2(1.,0.)),f.x),
 mix(groundHashV348(i+vec2(0.,1.)),groundHashV348(i+vec2(1.,1.)),f.x),f.y)-.5;
}
float groundRoleV348() {
 if(uGroundKindV348>0.)return uGroundKindV348;
 for(int i=0;i<8;i++){
  vec4 s=uGroundSelectorsV348[i];
  if(uGroundRolesV348[i]>0.&&max(max(abs(vGroundPaintV348.r-s.r),abs(vGroundPaintV348.g-s.g)),abs(vGroundPaintV348.b-s.b))<.000008&&
   (s.a< -900.||abs(vGroundWorldV348.y-s.a)<.002))return uGroundRolesV348[i];
 }
 return 0.;
}
vec3 groundFinishV348(vec3 paint) {
 float role=groundRoleV348();
 if(role<.5)return paint;
 vec3 dx=dFdx(vGroundWorldV348),dy=dFdy(vGroundWorldV348),n=cross(dx,dy);
 // Only upward-facing surface effect. Existing sidewalls/kerbs retain paint.
 if(abs(n.y)<length(n)*.8)return paint;
 float pixel=max(length(dx.xz),length(dy.xz));
 float nearFade=1.-smoothstep(.035,.22,pixel);
 float broadFade=1.-smoothstep(.25,1.25,pixel);
 float grain=groundNoiseV348(vGroundWorldV348.xz*(role>2.5&&role<3.5?5.:12.));
 float broad=groundNoiseV348(vGroundWorldV348.xz*(role>2.5&&role<3.5?.7:1.6));
 // All perturbations are multiplicative and below 3%; no synthetic slab grid.
 float modulation=1.+.036*grain*nearFade+.018*broad*broadFade;
 if(uGroundNightV348<.5){
  float luma=dot(paint,vec3(.2126,.7152,.0722));
  if(role>1.5&&role<2.5)paint=mix(paint,vec3(luma),.62)*.96;
  else if(role>2.5&&role<3.5)paint=mix(paint,vec3(luma),.18)*.84;
  else if(role<1.5)paint=mix(paint,vec3(luma),.16)*.94;
  // role4 is mapped path of unspecified material: grain only, no recolour.
 }
 return paint*modulation;
}
`;

/** Patches retain every original include and previous discard/shadow hook. */
export function patchGroundFinishShaderV348(vertex: string, fragment: string): { vertex: string; fragment: string } {
  if (vertex.includes('vGroundWorldV348') || fragment.includes('groundFinishV348')) return { vertex, fragment };
  if (!vertex.includes('#include <project_vertex>') || !vertex.includes('#include <color_vertex>') || !fragment.includes('#include <color_fragment>')) {
    throw Error('Unsupported ground material shader V348');
  }
  vertex = VARYINGS + vertex.replace('#include <project_vertex>', `
vec4 groundPositionV348=vec4(transformed,1.);
#ifdef USE_BATCHING
 groundPositionV348=batchingMatrix*groundPositionV348;
#endif
#ifdef USE_INSTANCING
 groundPositionV348=instanceMatrix*groundPositionV348;
#endif
vGroundWorldV348=(modelMatrix*groundPositionV348).xyz;
#include <project_vertex>`).replace('#include <color_vertex>', `#include <color_vertex>
vGroundPaintV348=vec3(1.);
#if defined(USE_COLOR)||defined(USE_COLOR_ALPHA)||defined(USE_INSTANCING_COLOR)||defined(USE_BATCHING_COLOR)
 vGroundPaintV348=vColor.rgb;
#endif`);
  fragment = GROUND_FINISH_GLSL_V348 + fragment.replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb=groundFinishV348(diffuseColor.rgb);');
  return { vertex, fragment };
}

function install(material: Material, spec: Spec): boolean {
  if (spec.kind === 'core-native' || bound.has(material)) return false;
  // Depth/distance/lines/points are deliberately not changed.
  if (!['MeshBasicMaterial','MeshStandardMaterial','MeshLambertMaterial','MeshPhongMaterial','MeshToonMaterial'].includes(material.type)) return false;
  const previous = material.onBeforeCompile, key = material.customProgramCacheKey;
  const binding: Binding = { spec, dead: false };
  bound.set(material, binding);
  const selectors = Array.from({length:8}, (_,i) => {
    const s=spec.selectors[i];return s?new Vector4(s.colour[0],s.colour[1],s.colour[2],s.y):new Vector4();
  });
  const roles=Array.from({length:8},(_,i)=>spec.selectors[i]?.role??0);
  material.onBeforeCompile=function(shader,renderer){
    previous.call(this,shader,renderer);
    if(binding.dead)return;
    const next=patchGroundFinishShaderV348(shader.vertexShader,shader.fragmentShader);
    shader.vertexShader=next.vertex;shader.fragmentShader=next.fragment;
    shader.uniforms.uGroundSelectorsV348={value:selectors};shader.uniforms.uGroundRolesV348={value:roles};
    shader.uniforms.uGroundKindV348={value:spec.kind in ROLES?ROLES[spec.kind as keyof typeof ROLES]:0};
    shader.uniforms.uGroundNightV348={value:+spec.night};
  };
  material.customProgramCacheKey=function(){return key.call(this)+'|semantic-ground-v348';};
  material.addEventListener('dispose',()=>{if(!isSceneMaterialProgramRetirementV321(material))binding.dead=true;});
  material.needsUpdate=true;
  return true;
}

/** Restore only this finish onto an independently created mode material. Never
 * copy unrelated source hooks: their owning modules keep their own lifetimes. */
export function inheritGroundFinishV348(source: Material, target: Material): boolean {
  const b=bound.get(source);return !!b&&!b.dead&&install(target,b.spec);
}

/** Call once on each newly attached root, before its aperture runtime records
 * exact hooks. No animation loop or per-frame traversal is installed here. */
export function bindGroundFinishV348(root: Object3D, native = false): number {
  if(native)return 0;
  let changed=0;
  root.traverse(object=>{
    if(!(object instanceof Mesh))return;
    const packet=packetMeshes.get(object),kind=object.userData[KEY] as GroundFinishKindV348;
    if(!packet&&!validKinds.has(kind)||kind==='core-native')return;
    const selectors=packet?.selectors??(kind==='core-drawn'?coreSelectors:[]);
    const seen=new Set<Material>();
    for(const [value,night]of[[object.userData.dayMaterial,false],[object.userData.nightMaterial,true],[object.userData.moonlitMaterial,true],[object.userData.schwellenraumMaterial,false],[object.material,false]]as const){
      for(const material of Array.isArray(value)?value:[value]){
        if(!(material instanceof Material)||seen.has(material))continue;seen.add(material);
        changed+=+install(material,{kind:packet?'packet':kind,selectors,night});
      }
    }
  });
  return changed;
}
