/** Actual Viewer lighting functions, both real private Runtime/factory/source
 * lifetimes, the actual old Drawn host, and a bounded complete Core transfer. */
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { Group, InstancedMesh, LineSegments, Material, Mesh, MeshBasicMaterial, MeshStandardMaterial } from "three";
import * as old from "../src/WilhelmHousingV324Runtime";
import * as street from "../src/WilhelmStreetFrontsV325Runtime";
import { createMitteDdrV288 } from "../src/MitteDdrV288";
import { createIsometricCityCore, setIsoNightPresentation } from "../src/IsometricCityWorld";
import { wilhelmHousingCorePlanV324 } from "../src/WilhelmHousingV324Core";
import { wilhelmStreetFrontsCorePlanV325 } from "../src/WilhelmStreetFrontsV325Core";
import { composeExactOwnersSourcesV321Steps, stageExactOwnersV321 } from "../src/ExactOwnersV321";
import { runtimeConstructorOptionsV310 } from "./helpers/northRuntimeActualV310";
import { compactStaticGeometry, compactStaticGeometrySteps } from "../src/compactStaticGeometry";
import { interleaveStaticGeometrySteps } from "../src/interleaveStaticGeometry";
import { parkStaticGeometrySteps, parkStaticInstancesSteps } from "../src/losslessStaticStorage";
import { schwellenraumObjektmodus } from "../src/visual-modes/schwellenraum/presentation";
import { schwellenraumMaterialFor, setSchwellenraumStandardMaterialTone } from "../src/visual-modes/schwellenraum/materialGrade";
import { applyArchitecturalInkMode } from "../src/architecturalInk";
import { setBuildingColorMode, setFlatUnlit } from "../src/drawnBuildings";

const drain = <T>(g: Generator<void, T>): T => { for (;;) { const n = g.next(); if (n.done) return n.value; } };
function actualLighting() {
  const text = readFileSync(new URL("../src/ThreeViewer.tsx", import.meta.url), "utf8");
  const ast = ts.createSourceFile("viewer.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names = ["voxelModeActive", "currentGovernmentOfficesV321", "applyGovernmentLightingV321", "applyLightingToRoot", "applyMaterialLighting"];
  const nodes = ast.statements.filter(n => ts.isFunctionDeclaration(n) && n.name && names.includes(n.name.text)); expect(nodes).toHaveLength(names.length);
  const js = ts.transpileModule(nodes.map(n => n.getText(ast)).join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  const deps = { exports: {}, Group, Mesh, LineSegments, MeshStandardMaterial, compactStaticGeometry, schwellenraumObjektmodus, schwellenraumMaterialFor,
    setSchwellenraumStandardMaterialTone, applyArchitecturalInkMode, setBuildingColorMode, setFlatUnlit,
    MOONLIGHT_EMISSIVE: 0x1c2636, MOONLIGHT_EMISSIVE_INTENSITY: .22,
    wilhelmHousingModuleV324: old, wilhelmStreetModuleV325: street };
  return new Function(...Object.keys(deps), js + ";return {applyGovernmentLightingV321};")(...Object.values(deps));
}

test("actual private siblings stay admitted and light on/off through the exact Viewer caller and ordinary parking", async () => {
  const p = JSON.parse(readFileSync(new URL("../public/mesh/regierungsviertel/lod2-prisms.json", import.meta.url), "utf8"));
  const world = new Group(), scene = new Group().add(world), govRoot = new Group(); world.add(govRoot);
  const housing = drain(old.createWilhelmHousingRuntimeV324Steps(world, p.buildings, undefined, false));
  const next = drain(street.createWilhelmStreetFrontsRuntimeV325Steps(world, p.buildings, undefined, false));
  expect(housing).not.toBeNull(); expect(next).not.toBeNull();
  world.add(createMitteDdrV288({})!);
  const plans = [wilhelmHousingCorePlanV324(), wilhelmStreetFrontsCorePlanV325()];
  const ids = new Set([...plans.flatMap(p => p.plan.owners.map(o => o.id)), "3qbK80tG", "400002kR", "40001MBA", "8ATaGDbD", "9mFgI41a", "FvtLRV0z", "lGcVZgqS"]);
  const selected = p.buildings.filter((b: any) => ids.has(b.id)); expect(selected).toHaveLength(66);
  const core = createIsometricCityCore(p, null, null, null, { ...runtimeConstructorOptionsV310(false, false, p), buildings: selected, includeContext: false, moabitMitteV300: false, westKiezV302: false }); world.add(core);
  drain(compactStaticGeometrySteps(world)); drain(interleaveStaticGeometrySteps(world));
  const source = drain(composeExactOwnersSourcesV321Steps(plans, p.buildings)); expect(source).not.toBeNull();
  const rawGate = () => old.getWilhelmHousingModelV324(world, false) === housing && street.getWilhelmStreetFrontsModelV325(world, false) === next;
  const tx = stageExactOwnersV321(core, source!, rawGate); expect(tx).not.toBeNull();
  try {
    expect(drain(old.prepareWilhelmHousingRuntimePreviousV324Steps(world, false))).toBeTrue();
    expect(drain(street.prepareWilhelmStreetFrontsRuntimePreviousV325Steps(world, false))).toBeTrue();
    expect(tx!.commit(rawGate)).toBeTrue(); expect(tx!.activeOwners).toHaveLength(59);
    const complete = () => govRoot.parent === world && tx!.complete();
    expect(old.attachWilhelmHousingCoreGateV324(world, false, complete)).toBeTrue();
    expect(street.attachWilhelmStreetFrontsCoreGateV325(world, false, complete)).toBeTrue();
    drain(parkStaticGeometrySteps(world, false)); drain(parkStaticInstancesSteps(world));
    const runtime = { isoWorld: world, voxelWorld: null, scene, lightingMode: "day", disposed: false, governmentOfficesV321: { drawn: { root: govRoot, complete } } };
    const api = actualLighting();
    const warm = [housing!, next!].map(root => root.children[1] as InstancedMesh);
    expect(warm.map(m => m.count)).toEqual([1389, 1261]);
    const foreign = new Mesh(undefined, new MeshBasicMaterial()), foreignNight = new MeshStandardMaterial();
    foreignNight.userData.nightEmissive = 0xE6C782; foreignNight.userData.nightEmissiveIntensity = .42;
    foreign.userData = { dayMaterial: foreign.material, nightMaterial: foreignNight, complete: true, wilhelmStreetFrontsV325: true }; world.add(foreign);
    for (const [mode, lightsOn] of [["day", true], ["night", true], ["night", false], ["night", true], ["day", true]] as const) {
      runtime.lightingMode = mode;
      // This is the order of the two real calls inside setSceneLighting.
      api.applyGovernmentLightingV321(runtime, mode, lightsOn);
      setIsoNightPresentation(world, mode === "night", lightsOn, mode);
      expect(old.hasWilhelmHousingRuntimeV324(world, false)).toBeTrue(); expect(street.hasWilhelmStreetFrontsRuntimeV325(world, false)).toBeTrue(); expect(tx!.complete()).toBeTrue();
      for (const mesh of warm) {
        const night = mesh.userData.nightMaterial as MeshStandardMaterial;
        expect(mesh.material).toBe(mode === "night" ? night : mesh.userData.dayMaterial);
        if(mode === "night") { expect(night.emissive.getHex()).toBe(lightsOn ? 0xE6C782 : 0); expect(night.emissiveIntensity).toBe(lightsOn ? .42 : 0); }
      }
      expect(foreignNight.emissive.getHex()).toBe(0);
    }
    // Private admission closes before an unparented Government root can relight
    // any leftover visible object. Public receipt-like labels grant nothing.
    runtime.lightingMode = "night"; api.applyGovernmentLightingV321(runtime, "night", false);
    govRoot.removeFromParent();
    api.applyGovernmentLightingV321(runtime, "night", true);
    expect(warm.every(m => (m.userData.nightMaterial as MeshStandardMaterial).emissive.getHex() === 0)).toBeTrue();
    expect(old.hasWilhelmHousingRuntimeV324(world, false)).toBeFalse(); expect(street.hasWilhelmStreetFrontsRuntimeV325(world, false)).toBeFalse();
    foreignNight.dispose();
  } finally {
    tx?.rollback(); street.releaseWilhelmStreetFrontsRuntimeV325(world, false); old.releaseWilhelmHousingRuntimeV324(world, false);
    const resources = new Set<{ dispose(): void }>(); world.traverse(object => { if (object instanceof Mesh || object instanceof LineSegments) {
      resources.add(object.geometry); if (object instanceof InstancedMesh) resources.add(object);
      for (const material of [object.material, object.userData.dayMaterial, object.userData.nightMaterial, object.userData.schwellenraumMaterial].flat()) if (material instanceof Material) resources.add(material);
    } }); for (const resource of resources) resource.dispose(); world.clear(); scene.clear();
  }
}, 30000);
