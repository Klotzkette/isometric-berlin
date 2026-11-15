/** Photo-informed frosted glass-block finish for the existing Washingtonplatz walls. */
import { Material, Mesh, type Object3D } from 'three';
import { isSceneMaterialProgramRetirementV321 } from './sceneMaterialPrograms';
export const HBF_VENT_FINISH_V349 = Object.freeze({
  owner: 'Hauptbahnhof Washingtonplatz DB pylon',
  source: 'https://www.sbp.de/projekt/berlin-hauptbahnhof-abluftkamin/',
  photo: 'https://www.sbp.de/app/uploads/2021/12/2156_1268_a_MAX.jpg',
  // Display modules fitted to the retained frame fields, not a survey.
  blockWidthM: 8.2 / 30, blockHeightM: .315,
  geometryStatus: 'photo-informed estimated glass-block module; existing official-height owner retained',
});
const KEY = 'hbfVentFinishV349', TAG = 'washingtonplatz-frosted-glass-blocks';
const bindings = new WeakMap<Material, { dead: boolean }>();
/** Scalar factory provenance survives the existing Worker transport. */
export function markHbfVentFinishV349(mesh: Mesh): void {
  if (mesh.name === HBF_VENT_FINISH_V349.owner) mesh.userData[KEY] = TAG;
}
const VARYING = 'varying vec3 vHbfVentLocalV349;\n';
export const HBF_VENT_FINISH_GLSL_V349 = `
${VARYING}
vec3 hbfVentFinishV349(vec3 paint) {
 vec3 dx=dFdx(vHbfVentLocalV349),dy=dFdy(vHbfVentLocalV349);
 vec3 n=cross(dx,dy);
 // Only the broad infill faces; original narrow edges keep their finish.
 if(abs(n.z)<length(n)*.9)return paint;
 vec2 p=(vHbfVentLocalV349.xy+vec2(4.1,30.))/vec2(.2733333333,.315);
 vec2 fw=fwidth(p);
 float fade=1.-smoothstep(.22,.8,max(fw.x,fw.y));
 vec2 cell=floor(p),f=fract(p),edge=min(f,1.-f);
 vec2 aa=max(fw*.75,vec2(.0001));
 vec2 joint=1.-smoothstep(vec2(.025)-aa,vec2(.025)+aa,edge);
 float mortar=max(joint.x,joint.y);
 // Quiet individual block tone and a shallow optical rim, no displacement.
 float seed=fract(sin(dot(cell,vec2(127.1,311.7)))*43758.5453)-.5;
 float lens=smoothstep(.035,.18,min(edge.x,edge.y));
 float tone=1.+fade*(seed*.035+(lens-.55)*.025+mortar*.085);
 float luma=dot(paint,vec3(.2126,.7152,.0722));
 return mix(paint,vec3(luma),mortar*.12*fade)*tone;
}
`;
export function patchHbfVentFinishShaderV349(vertex: string, fragment: string): { vertex: string; fragment: string } {
  if (vertex.includes('vHbfVentLocalV349') || fragment.includes('hbfVentFinishV349')) return { vertex, fragment };
  if (!vertex.includes('#include <project_vertex>') || !fragment.includes('#include <color_fragment>')) throw Error('Unsupported Washingtonplatz infill shader V349');
  vertex = VARYING + vertex.replace('#include <project_vertex>', 'vHbfVentLocalV349=transformed;\n#include <project_vertex>');
  fragment = HBF_VENT_FINISH_GLSL_V349 + fragment.replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb=hbfVentFinishV349(diffuseColor.rgb);');
  return { vertex, fragment };
}
function install(material: Material): boolean {
  if (bindings.has(material) || !['MeshBasicMaterial','MeshStandardMaterial','MeshLambertMaterial','MeshPhongMaterial','MeshToonMaterial'].includes(material.type)) return false;
  const previous = material.onBeforeCompile;
  // Three's default key reads this.onBeforeCompile: capture before wrapping so
  // distinct earlier hooks remain distinct and later grade wrappers cannot alter it.
  const previousKey = material.customProgramCacheKey();
  const binding = { dead: false }; bindings.set(material, binding);
  material.onBeforeCompile = function(shader, renderer) {
    previous.call(this, shader, renderer);
    if (binding.dead) return;
    const patched = patchHbfVentFinishShaderV349(shader.vertexShader, shader.fragmentShader);
    shader.vertexShader = patched.vertex; shader.fragmentShader = patched.fragment;
  };
  material.customProgramCacheKey = () => previousKey + '|hbf-vent-finish-v349';
  material.addEventListener('dispose', () => { if (!isSceneMaterialProgramRetirementV321(material)) binding.dead = true; });
  material.needsUpdate = true;
  return true;
}
/** Inherit this finish only; unrelated hooks retain their own lifetimes. */
export function inheritHbfVentFinishV349(source: Material, target: Material): boolean {
  const binding = bindings.get(source);
  return !!binding && !binding.dead && install(target);
}
/** Attach-time only; independent Native station deliberately unaffected. */
export function bindHbfVentFinishV349(root: Object3D, native = false): number {
  if (native) return 0;
  let changed = 0;
  root.traverse(object => {
    if (!(object instanceof Mesh) || object.name !== HBF_VENT_FINISH_V349.owner || object.userData[KEY] !== TAG) return;
    const seen = new Set<Material>();
    for (const value of [object.userData.dayMaterial, object.userData.nightMaterial, object.userData.moonlitMaterial, object.userData.schwellenraumMaterial, object.material]) {
      for (const material of Array.isArray(value) ? value : [value]) {
        if (!(material instanceof Material) || seen.has(material)) continue;
        seen.add(material); changed += +install(material);
      }
    }
  });
  return changed;
}
