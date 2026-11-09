import {
  DataTexture,
  Mesh,
  MeshStandardMaterial,
  MeshToonMaterial,
  NearestFilter,
  Object3D,
  RedFormat,
  type Material,
} from "three";
import {hasSchwellenraumMaterialProvenance} from "../schwellenraum/materialGrade";
import {isSceneMaterialProgramRetirementV321} from "../../sceneMaterialPrograms";

export type MinecraftMaterialState = {
  gradientMap: DataTexture;
  originals: Map<Mesh, Material | Material[]>;
  toonBySource: Map<Material, MeshToonMaterial>;
};

type FlatToonMaterial = MeshToonMaterial & { flatShading: boolean };
type SourceMaterial=Material|Material[];
type Resource={disposed:boolean};
type Factory={source:Material;material:Material;state:MinecraftMaterialState;resource:Resource};
type Binding={mesh:Mesh;state:MinecraftMaterialState;original:Material;candidate:Material;active:boolean};
type PrivateState={disposed:boolean;originals:Map<Mesh,SourceMaterial>;bindings:Map<Mesh,Binding>;factories:Map<Material,Factory>};
const privateStates=new WeakMap<MinecraftMaterialState,PrivateState>();
const privateBindings=new WeakMap<Mesh,Binding>();
const resources=new WeakMap<Material,Resource>();
const factories=new WeakMap<Material,Factory>();
const copiedStates=new WeakMap<Mesh,MinecraftMaterialState>();
function resourceFor(material:Material):Resource{
 let record=resources.get(material);if(record)return record;
 record={disposed:false};const owned=record;material.addEventListener("dispose",()=>{if(!isSceneMaterialProgramRetirementV321(material))owned.disposed=true;});resources.set(material,record);return record;
}
function invalidate(mesh:Mesh):void{
 const binding=privateBindings.get(mesh);if(!binding)return;
 binding.active=false;privateBindings.delete(mesh);privateStates.get(binding.state)?.bindings.delete(mesh);
}
function validBinding(binding:Binding):boolean{
 const {mesh,state,original,candidate}=binding,owner=privateStates.get(state);
 if(!binding.active||!owner||owner.disposed||privateBindings.get(mesh)!==binding||
  owner.originals.get(mesh)!==original||state.originals.get(mesh)!==original||mesh.material!==candidate||
  resourceFor(original).disposed||resourceFor(candidate).disposed)return false;
 if(original instanceof MeshStandardMaterial){
  const factory=owner.factories.get(original);
  return !!factory&&factory.material===candidate&&factory.state===state&&!factory.resource.disposed&&
   factories.get(candidate)===factory&&state.toonBySource.get(original)===candidate;
 }
 // A second state's direct binding to another state's generated toon is not
 // evidence for the original source material or for an inherited presentation.
 return candidate===original&&!factories.has(original);
}
function registerBinding(mesh:Mesh,state:MinecraftMaterialState,original:SourceMaterial):void{
 invalidate(mesh);
 const owner=privateStates.get(state);
 if(!owner||owner.disposed||Array.isArray(original)||Array.isArray(mesh.material)||owner.originals.get(mesh)!==original)return;
 const binding:Binding={mesh,state,original,candidate:mesh.material,active:true};
 privateBindings.set(mesh,binding);owner.bindings.set(mesh,binding);
 if(!validBinding(binding))invalidate(mesh);
}

/** Only actual source/state/factory bindings authorize a late complete model.
 * Public maps, copied userData, arbitrary clones and foreign states do not. */
export function hasMinecraftMaterialProvenance(mesh:Mesh,sourceMaterial:Material,candidate:unknown):candidate is Material{
 const binding=privateBindings.get(mesh);
 return !!binding&&candidate===binding.candidate&&validBinding(binding)&&
  (binding.original===sourceMaterial||hasSchwellenraumMaterialProvenance(mesh,sourceMaterial,binding.original));
}

/** Private active backlink for constructors whose original material has no
 * public day/night slot. An inactive or forged binding has no source backlink. */
export function minecraftOriginalMaterialFor(mesh:Mesh):Material|null{
 const binding=privateBindings.get(mesh);return binding&&validBinding(binding)?binding.original:null;
}

/** Apply the source mesh's real active state to the target's OWN original
 * material through the same provider. Source material identities stay intact. */
export function copyMinecraftMaterialPresentation(sourceMesh:Mesh,targetMesh:Mesh):boolean{
 const binding=privateBindings.get(sourceMesh);
 if(!binding||!validBinding(binding)||Array.isArray(targetMesh.material))return false;
 const previous=copiedStates.get(targetMesh);
 if(previous&&previous!==binding.state)return false;
 const owner=privateStates.get(binding.state)!;
 const original=binding.state.originals.get(targetMesh)??targetMesh.material;
 if(Array.isArray(original)||resourceFor(original).disposed||factories.has(original)||
  binding.state.originals.has(targetMesh)&&owner.originals.get(targetMesh)!==original)return false;
 const cached=original instanceof MeshStandardMaterial?binding.state.toonBySource.get(original):undefined;
 if(cached){const factory=owner.factories.get(original);if(!factory||factory.material!==cached||factory.resource.disposed||factories.get(cached)!==factory)return false;}
 presentMesh(targetMesh,binding.state,true);
 const target=privateBindings.get(targetMesh);
 const copied=!!target&&target.state===binding.state&&validBinding(target);
 if(copied)copiedStates.set(targetMesh,binding.state);
 return copied;
}

/** Release a copied target after it has been detached from the live tree.
 * This also works after restore/invalidation; the shared gradient is retained. */
export function releaseCopiedMinecraftMaterialPresentation(targetMesh:Mesh):void{
 const state=copiedStates.get(targetMesh);if(!state)return;
 releaseMinecraftMaterialBindings(targetMesh,state);copiedStates.delete(targetMesh);
}

export function createMinecraftMaterialState(): MinecraftMaterialState {
  // Two-step toon gradient: shading snaps hard between a dark shadow
  // side and a lit side, the stepped "voxel cube" look. (v0.5.2 used
  // three steps, which read as a smooth photographic ramp.)
  const gradientMap = new DataTexture(new Uint8Array([64, 236]), 2, 1, RedFormat);
  gradientMap.minFilter = NearestFilter;
  gradientMap.magFilter = NearestFilter;
  gradientMap.needsUpdate = true;
  const state:MinecraftMaterialState={
    gradientMap,
    originals: new Map(),
    toonBySource: new Map(),
  };
  const owner:PrivateState={disposed:false,originals:new Map(),bindings:new Map(),factories:new Map()};
  privateStates.set(state,owner);
  gradientMap.addEventListener("dispose",()=>{owner.disposed=true;for(const binding of [...owner.bindings.values()])invalidate(binding.mesh);});
  return state;
}

function toonMaterialFor(
  source: Material,
  state: MinecraftMaterialState,
): Material {
  if (!(source instanceof MeshStandardMaterial)) {
    return source;
  }
  const cached = state.toonBySource.get(source);
  if (cached) {
    return cached;
  }
  const material = new MeshToonMaterial({
    alphaTest: source.alphaTest,
    color: source.color,
    depthTest: source.depthTest,
    depthWrite: source.depthWrite,
    emissive: source.emissive,
    emissiveIntensity: Math.max(source.emissiveIntensity, 0.08),
    emissiveMap: source.emissiveMap,
    gradientMap: state.gradientMap,
    map: source.map,
    opacity: source.opacity,
    polygonOffset: source.polygonOffset,
    polygonOffsetFactor: source.polygonOffsetFactor,
    polygonOffsetUnits: source.polygonOffsetUnits,
    side: source.side,
    transparent: source.transparent,
    vertexColors: source.vertexColors,
  }) as FlatToonMaterial;
  material.flatShading = true;
  material.name = `${source.name || source.type} premium voxel material`;
  material.userData = { ...source.userData, minecraftToon: true };
  state.toonBySource.set(source, material);
  const owner=privateStates.get(state);
  if(owner&&!owner.disposed){const factory:Factory={source,material,state,resource:resourceFor(material)};
    resourceFor(source);owner.factories.set(source,factory);factories.set(material,factory);}
  return material;
}

function presentMesh(object:Mesh,state:MinecraftMaterialState,enabled:boolean):void{
 if(enabled){
  if(!state.originals.has(object)){
   state.originals.set(object,object.material);
   privateStates.get(state)?.originals.set(object,object.material);
  }
  const original=state.originals.get(object);if(!original)return;
  object.material=Array.isArray(original)?original.map(material=>toonMaterialFor(material,state)):toonMaterialFor(original,state);
  registerBinding(object,state,original);return;
 }
 const original=state.originals.get(object);
 if(original){object.material=original;invalidate(object);}
}

export function setMinecraftMaterialPresentation(
  root: Object3D,
  state: MinecraftMaterialState,
  enabled: boolean,
): void {
  root.traverse((object) => {
    if (!(object instanceof Mesh)) {
      return;
    }
    presentMesh(object,state,enabled);
  });
}

/** Restore only meshes that were actually converted, without walking the city. */
export function restoreMinecraftMaterialPresentation(
  state: MinecraftMaterialState,
): void {
  for (const [mesh, original] of state.originals) {
    mesh.material = original;
    invalidate(mesh);
  }
}

export function releaseMinecraftMaterialBindings(
  root: Object3D,
  state: MinecraftMaterialState,
): void {
  const releasedSources = new Set<Material>();
  const belongsToRoot = (object: Object3D): boolean => {
    for (let current: Object3D | null = object; current; current = current.parent) {
      if (current === root) return true;
    }
    return false;
  };
  for (const [object, original] of state.originals) {
    if (!belongsToRoot(object)) continue;
    object.material = original;
    invalidate(object);
    for (const material of Array.isArray(original) ? original : [original]) {
      releasedSources.add(material);
    }
    state.originals.delete(object);
    privateStates.get(state)?.originals.delete(object);
  }
  const retainedSources = new Set<Material>();
  for (const original of state.originals.values()) {
    for (const material of Array.isArray(original) ? original : [original]) {
      retainedSources.add(material);
    }
  }
  for (const source of releasedSources) {
    if (retainedSources.has(source)) {
      continue;
    }
    state.toonBySource.get(source)?.dispose();
    state.toonBySource.delete(source);
    privateStates.get(state)?.factories.delete(source);
  }
}

export function disposeMinecraftMaterialState(
  state: MinecraftMaterialState,
): void {
  const owner=privateStates.get(state);
  if(owner){owner.disposed=true;for(const binding of [...owner.bindings.values()])invalidate(binding.mesh);owner.originals.clear();owner.factories.clear();}
  for (const material of state.toonBySource.values()) {
    material.dispose();
  }
  state.gradientMap.dispose();
  state.originals.clear();
  state.toonBySource.clear();
}
