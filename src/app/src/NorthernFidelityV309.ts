/** Loaded only for a visible requested northern/clinical site, never the shell. */
import { Group, Mesh, type Object3D } from "three";
import { createNorthSitesV306, hasCompleteNorthSitesV306 } from "./NorthSitesV306";
import { createRailTerrainContactApproachStepsV309, hasCompleteRailTerrainContactApproachV309 } from "./RailTerrainContactV307";
import { createRailSseArchitectureStepsV309, hasCompleteRailSseArchitectureV307 } from "./RailSseArchitectureV307";
import { createHospitalArchitectureV308, hasCompleteHospitalArchitectureV308 } from "./HospitalArchitectureV308";
import { createGesundbrunnenRoadBridgesStepsV309, hasCompleteGesundbrunnenRoadBridgesV309 } from "./GesundbrunnenRoadBridgesV309";
import { prepareGesundbrunnenBridgeInkV309Steps, type GesundbrunnenBridgeInkTransactionV309 } from "./GesundbrunnenBridgeInkV309";
import { createGesundbrunnenRoadBridgeNavigationV309 } from "./gesundbrunnenRoadBridgeNavigationV309";
import { applyHospitalPreviousV308 } from "./HospitalArchitectureV308Previous";
import { applyRailSseLegacyV307 } from "./RailSseLegacyV307";
import { hospitalArchitectureV308Solids, hospitalV308OverridesV228 } from "./HospitalArchitectureV308Navigation";
import { northSitesV306Solids, northSchoolGroundAtV306 } from "./northSitesV306Navigation";
import { northParkTerrainOffsetV306, northParkTerrainFieldAtV306 } from "./northParkTerrainV306";
import { createCoreHumboldtNavigationV307 } from "./coreTerrainNavigationV307";
import { type NorthCoreTerrainRecipesV309, type NorthCoreTerrainTransactionV309, type NorthCoreTerrainRebindV309 } from "./NorthCoreTerrainV309";
import { stageNorthTerrainDrapingV309Steps, type NorthTerrainDrapingV309Transaction } from "./northTerrainDrapingV309";
import coreRecipes from "./data/coreTerrainContactV307.json";
import type { NorthCoreBridgeDeltaV309 } from "./NorthCoreBridgeTerrainV309";
import type { NorthCoreActualDeltaV310 } from "./NorthCoreActualTerrainV310";
import { prepareNorthCoreEnginesV311Steps, type CoreWorkerV8ProfileV311 } from "./NorthCoreEnginesV311";
import workerV8Profile from "./data/coreWorkerV8V311.json";
import actualCoreDelta from "./data/coreTerrainActualV310.json";
import bridgeCoreDelta from "./data/gesundbrunnenBridgeCoreV309Delta.json";
import { parkReliefAt } from "./parkReliefV182";
import { railSseArchitectureV307Solids, railSseGroundAtV307, quantizeNativeTerrainHeightV307 } from "./railSseNavigationV307";
import { createNorthernNavigationV309 } from "./NorthernNavigationV309";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

export type NorthernFidelityContextV309 = {
  world: Group;
  props: () => readonly Object3D[];
  originalGroundAt: (x: number, z: number) => number | null;
  beforeSwap?: NorthCoreTerrainRebindV309;
  afterSwap?: () => void;
};
export type NorthernFidelityBundleV309 = {
  root: Group;
  prepared(): boolean;
  complete(): boolean;
  terrainAt(x: number, z: number): number | null;
  floorAt(x: number, z: number, current: number): number | null;
  solidAt(x: number, y: number, z: number, radius?: number): boolean;
  overridesOldHospitalAt(x: number, z: number): boolean;
  syncPrevious(root: Object3D, enabled: boolean): boolean;
  preparePropsSteps(root: Object3D): Generator<void, NorthTerrainDrapingV309Transaction>;
  retireProps(root: Object3D): void;
  architecture: Group;
  contact: Group;
  hospital: Group;
  bridges: Group;
};

/** Stage every replacement and retained prop before old visible owners yield.
 * The caller owns the provisional root immediately, including on cancellation. */
export function* createNorthernFidelityStepsV309(native: boolean, mobileLike: boolean, context: NorthernFidelityContextV309, onCreate?: (root: Group) => void): Generator<void, NorthernFidelityBundleV309> {
  const root = new Group(); root.name = "Measured northern parks, rail and clinical architecture v309";
  root.userData = { textureFree: true, fullStaticDetailOnTouch: true, nativeMinecraft: native, blockNative: native, keepInMinecraft: native };
  onCreate?.(root);
  let core: NorthCoreTerrainTransactionV309 | null = null, ink: GesundbrunnenBridgeInkTransactionV309 | null = null, delivered = false, active = false, closed = false;
  const props = new Map<Object3D, NorthTerrainDrapingV309Transaction>();
  const committingProps = new Set<Object3D>();
  let propsSettled=false;
  const currentProps=()=>[...new Set(context.props())];
  const propsPrepared=()=>propsSettled&&currentProps().every(r=>props.has(r));
  // Each wrapper is privately associated before it can enter a commit scope.
  function registerProps(owner:Object3D,transaction:NorthTerrainDrapingV309Transaction){
    const wrapped:NorthTerrainDrapingV309Transaction={...transaction,
      commit(gate){if(props.get(owner)!==wrapped)return 0;committingProps.add(owner);try{return transaction.commit(gate);}finally{committingProps.delete(owner);}},
      rollback(){if(props.get(owner)===wrapped)props.delete(owner);return transaction.rollback();},
    };props.set(owner,wrapped);return wrapped;
  }
  try {
    const school = createNorthSitesV306(native); root.add(school); yield;
    const contact = yield* createRailTerrainContactApproachStepsV309(native, { mobileLike }, child => { root.add(child); }); yield;
    const architecture = yield* createRailSseArchitectureStepsV309(native, { mobileLike }, child => { root.add(child); }); yield;
    const hospital = createHospitalArchitectureV308(native, { mobileLike }); root.add(hospital); yield;
    const bridges = yield* createGesundbrunnenRoadBridgesStepsV309(native, { mobileLike }, child => { root.add(child); }); yield;
    const children = [school, contact, architecture, hospital, bridges];
    root.traverse(object => { if (object instanceof Mesh) object.geometry.userData.losslessStaticBacking = true; });
    freezeStaticSceneTransforms(root);
    const matrix = root.matrix.elements.slice(), position = root.position.toArray(), quaternion = root.quaternion.toArray(), scale = root.scale.toArray();
    const modelComplete = () => !closed && root.visible && !root.matrixAutoUpdate && root.children.length === children.length && children.every((child, i) => root.children[i] === child && child.parent === root) &&
      root.matrix.elements.every((v, i) => v === matrix[i]) && root.position.toArray().every((v, i) => v === position[i]) && root.quaternion.toArray().every((v, i) => v === quaternion[i]) && root.scale.toArray().every((v, i) => v === scale[i]) &&
      hasCompleteNorthSitesV306(school, native) && hasCompleteRailTerrainContactApproachV309(contact, native) && hasCompleteRailSseArchitectureV307(architecture, native) && hasCompleteHospitalArchitectureV308(hospital, native) && hasCompleteGesundbrunnenRoadBridgesV309(bridges, native);
    const liveModelComplete = () => modelComplete() && propsPrepared() && root.parent === context.world;
    const complete = () => active && liveModelComplete() && core?.complete() === true && ink?.complete() === true && currentProps().every(owner => committingProps.has(owner) || props.get(owner)?.complete() === true);
    if (!modelComplete()) throw Error("Incomplete northern source ensemble");
    const humboldtGroundAt = createCoreHumboldtNavigationV307(contact, native);
    const bridgeNavigation = createGesundbrunnenRoadBridgeNavigationV309(bridges, native);
    const stagedTerrainAt = (x: number, z: number): number | null => {
      if (!modelComplete()) return null;
      const schoolGround = northSchoolGroundAtV306(x, z, native); if (schoolGround !== null) return schoolGround;
      const lowerBridgeGround = bridgeNavigation.groundAt(x, z); if (lowerBridgeGround !== null) return lowerBridgeGround;
      const railGround = railSseGroundAtV307(x, z, native); if (railGround !== null) return railGround;
      const humboldtGround = humboldtGroundAt(x, z); if (humboldtGround !== null) return humboldtGround;
      if (northParkTerrainFieldAtV306(x, z, native) !== "friedrichshain") return null;
      const delta = northParkTerrainOffsetV306(x, z, native); if (!delta) return null;
      const top = parkReliefAt(x, z, 3, native) + delta;
      return native ? quantizeNativeTerrainHeightV307(Math.ceil(top * 8) / 8) : top;
    };
    const drapingOptions = {
      enabled: true, native,
      parkOffsetAt: northParkTerrainOffsetV306,
      railGroundAt: stagedTerrainAt,
      oldGroundAt: (x: number, z: number) => parkReliefAt(x, z, context.originalGroundAt(x, z) ?? 3, native),
    };
    core = yield* prepareNorthCoreEnginesV311Steps(context.world, native, modelComplete, coreRecipes as unknown as NorthCoreTerrainRecipesV309, bridgeCoreDelta as unknown as NorthCoreBridgeDeltaV309, actualCoreDelta as unknown as NorthCoreActualDeltaV310, workerV8Profile as unknown as CoreWorkerV8ProfileV311);
    if (!core) throw Error("Actual settled Core terrain does not match the complete northern source receipt");
    ink = yield* prepareGesundbrunnenBridgeInkV309Steps(context.world, native, modelComplete, bridges);
    if (!ink) throw Error("Actual settled source curb ink does not match the complete bridge receipt");
    // A deferred park can publish while this cooperative stage is suspended.
    // Retain stable members, discard obsolete plans, and stage every current
    // root again before exposing a prepared ensemble.
    for (;;) {
      const wanted=currentProps(),set=new Set(wanted);
      for(const[old,transaction]of props)if(!set.has(old))transaction.rollback();
      for(const owner of wanted)if(!props.has(owner)){
        registerProps(owner,yield*stageNorthTerrainDrapingV309Steps(owner,drapingOptions));yield;
      }
      const latest=currentProps();
      if(latest.length===wanted.length&&latest.every(r=>set.has(r))){propsSettled=true;break;}
      yield;
    }
    const navigation = createNorthernNavigationV309([...northSitesV306Solids(native), ...railSseArchitectureV307Solids(native), ...hospitalArchitectureV308Solids(native), ...bridgeNavigation.solids], complete, stagedTerrainAt);
    const restore = (legacy: Object3D) => {
      const wasOpen = !closed;
      active = false;
      applyHospitalPreviousV308(legacy, native, false, hospital, context.world);
      applyRailSseLegacyV307(legacy, native, false, architecture, contact);
      for (const transaction of props.values()) transaction.rollback();
      props.clear(); ink?.rollback(); core?.rollback(); closed = true;
      if (wasOpen) context.afterSwap?.();
    };
    delivered = true;
    return {
      root, prepared: () => modelComplete() && propsPrepared(), complete, ...navigation,
      terrainAt: (x, z) => complete() ? stagedTerrainAt(x, z) : null,
      architecture, contact, hospital, bridges,
      overridesOldHospitalAt: (x, z) => complete() && hospitalV308OverridesV228(x, z, native),
      *preparePropsSteps(nextProps) {
        const previous=props.get(nextProps);if(previous)return previous;
        const transaction = yield* stageNorthTerrainDrapingV309Steps(nextProps, drapingOptions);
        const concurrent=props.get(nextProps);if(concurrent){transaction.rollback();return concurrent;}
        return registerProps(nextProps,transaction);
      },
      retireProps(oldProps) { props.get(oldProps)?.rollback(); props.delete(oldProps); },
      syncPrevious(legacy, enabled) {
        if (!enabled) { restore(legacy); return true; }
        if (!propsPrepared() || !liveModelComplete() || !core?.commit(liveModelComplete, context.beforeSwap) || !ink?.commit(liveModelComplete, context.beforeSwap)) { restore(legacy); return false; }
        if (!active) for (const owner of currentProps()) {
          const transaction=props.get(owner)!;transaction.commit(liveModelComplete);
          if (!transaction.complete()) { restore(legacy); return false; }
        }
        if(!currentProps().every(r=>props.get(r)?.complete()===true)){restore(legacy);return false;}
        if (!applyHospitalPreviousV308(legacy, native, true, hospital, context.world) || !applyRailSseLegacyV307(legacy, native, true, architecture, contact)) { restore(legacy); return false; }
        if (!active) context.afterSwap?.();
        active = true; return complete();
      },
    };
  } finally {
    if (!delivered) { for (const transaction of props.values()) transaction.rollback(); ink?.rollback(); core?.rollback(); }
  }
}
