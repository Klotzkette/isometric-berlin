import { expect, test } from "bun:test";
import { EUROPACITY_PROFILE } from "../src/expandedCityProfiles";
import { upbeatV166DetailBoxes, upbeatV166NativeAccents } from "../src/upbeatV166Details";
test("Upbeat preserves mapped curved envelope and published tiers with current handover",()=>{
 const p=EUROPACITY_PROFILE.upbeat;expect(p.osmWayId).toBe("1214009386");expect(p.footprintWorldM).toHaveLength(61);expect(p.heightM).toBe(82);expect(p.storeyTiers).toEqual([5,11,19]);expect(p.tierTopHeightsM).toEqual([21.579,47.474,82]);expect(p.completedState).toContain("5 August 2026");expect(p.completedState).toContain("13 October 2026");
});
test("Upbeat detail is finite exterior relief with bounded orthogonal native accents",()=>{
 const detail=upbeatV166DetailBoxes(),native=upbeatV166NativeAccents();expect(detail.length).toBeLessThan(4500);expect(detail.filter(r=>r.role==="flute").length).toBeGreaterThan(500);expect(detail.filter(r=>r.role==="rail").length).toBeGreaterThan(40);expect(detail.filter(r=>r.role==="entry")).toHaveLength(4);expect(native.length).toBeLessThan(6000);expect(native.length).toBeGreaterThan(800);
 for(const r of [...detail,...native]){expect([...r.position,...r.size].every(Number.isFinite)).toBe(true);expect(r.size.every(x=>x>0)).toBe(true);expect(r.position[1]+r.size[1]/2).toBeLessThanOrEqual(EUROPACITY_PROFILE.upbeat.groundY+82+.0001);}
 expect(new Set(native.map(r=>r.position.join(','))).size).toBe(native.length);console.log({drawnBoxes:detail.length,nativeAccents:native.length});
});

test("Upbeat drawn addition is one compact instanced batch with full touch parity",async()=>{
 const {createUpbeatV166FacadeDetails}=await import("../src/UpbeatV166FacadeDetails");
 const {InstancedMesh}=await import("three");
 const desktop=createUpbeatV166FacadeDetails(),touch=createUpbeatV166FacadeDetails({mobileLike:true});
 expect(desktop.children).toHaveLength(1);expect(desktop.children[0] instanceof InstancedMesh).toBe(true);
 const a=desktop.children[0] as InstanceType<typeof InstancedMesh>,b=touch.children[0] as InstanceType<typeof InstancedMesh>;
 expect(a.instanceMatrix.array).toEqual(b.instanceMatrix.array);expect(a.count).toBe(3850);expect(a.matrixAutoUpdate).toBe(false);
 const bytes=Object.values(a.geometry.attributes).reduce((sum,r)=>sum+r.array.byteLength,0)+(a.geometry.index?.array.byteLength??0)+a.instanceMatrix.array.byteLength+a.instanceColor!.array.byteLength;expect(bytes).toBeLessThan(300000);console.log({upbeatDrawnBytes:bytes,instances:a.count});
});
