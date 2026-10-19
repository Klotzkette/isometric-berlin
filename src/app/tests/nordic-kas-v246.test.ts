import { describe, expect, test } from "bun:test";
import { Mesh } from "three";
import source from "../src/data/nordicAndKasV246.json";
import { addNordicAndKasV246, createMinecraftNordicAndKasV246, nordicKasEmissionsV246, NORDIC_KAS_V246_PROFILE } from "../src/NordicAndKasV246";
import { createBuilder, finishDrawnGroup } from "../src/drawnKit";
import { createDiplomaticAndRobertKochDetails } from "../src/DiplomaticAndRobertKochDetails";
import { disposeStaticAudit, staticGeometryAudit } from "./helpers/staticGeometryAudit";

describe("v246 Nordic embassies and KAS source-bound recognition", () => {
  test("six national/public houses, exact KAS offices and preserved academy/CDU identities stay distinct", () => {
    expect(new Set(source.faces.filter(f => !f.style.startsWith("kas")).map(f => f.osmWayId)).size).toBe(6);
    expect(NORDIC_KAS_V246_PROFILE.nordicHouses).toContain("26746071");
    expect(NORDIC_KAS_V246_PROFILE.kasOfficeOwners).toEqual(["33135651", "609711202"]);
    expect(source.faces.some(f => f.osmWayId === "33755520" || f.osmWayId === "25999445")).toBe(false);
  });

  test("copper stays on all 51 source segments and never closes the entrance", () => {
    const copper = nordicKasEmissionsV246().filter(e => e.role === "copper-lamella");
    expect(copper).toHaveLength(source.copper.length * 48);
    expect(source.copper).toHaveLength(51);
    for (const item of copper) {
      expect(item.double).toBe(true);
      const v = item.vertices;
      expect(source.copper.some(c => {
        const dx = c.b[0] - c.a[0], dz = c.b[1] - c.a[1], l = Math.hypot(dx, dz);
        return [0, 3, 6, 9].every(i => {
          const x = v[i] - c.a[0], z = v[i + 2] - c.a[1];
          const along = (x * dx + z * dz) / l, depth = (x * dz - z * dx) / l;
          return along >= -1e-6 && along <= l + 1e-6 && Math.abs(depth - .14) < 1e-6;
        });
      })).toBe(true);
      expect(v[1]).toBeGreaterThanOrEqual(5.2);
      expect(Math.max(v[1], v[4], v[7], v[10])).toBeLessThanOrEqual(20.2);
    }
  });

  test("every drawn fitting remains within its exact retained wall, without a roof/body replacement", () => {
    const model = nordicKasEmissionsV246();
    for (const q of model.filter(e => e.owner !== "25999438")) {
      expect(source.faces.some(f => {
        if (f.owner !== q.owner) return false;
        const dx = f.b[0] - f.a[0], dz = f.b[1] - f.a[1], l = Math.hypot(dx, dz);
        return [0, 3, 6, 9].every(i => {
          const x = q.vertices[i] - f.a[0], z = q.vertices[i + 2] - f.a[1];
          const u = (x * dx + z * dz) / l, depth = x * f.normal[0] + z * f.normal[1];
          return u >= .014 && u <= l - .014 && depth >= .025 && depth <= .30 &&
            q.vertices[i + 1] >= f.low + .024 && q.vertices[i + 1] <= f.high - .149;
        });
      })).toBe(true);
    }
    for (const role of ["finnish-larch-screen", "norwegian-granite-monolith", "felleshus-maple-course", "danish-metal-screen", "rhyolite-course", "frosted-glass-sunshade", "kas-travertine-field"])
      expect(model.some(e => e.role === role)).toBe(true);
  });

  test("native geometry is independently orthogonal and lies on actual delivered column faces", () => {
    const quads = nordicKasEmissionsV246(true);
    for (const q of quads) {
      const v = q.vertices, xs = [v[0],v[3],v[6],v[9]], zs = [v[2],v[5],v[8],v[11]];
      expect(v.every(Number.isFinite)).toBe(true);
      expect(Math.max(...xs) - Math.min(...xs) < 1e-8 || Math.max(...zs) - Math.min(...zs) < 1e-8).toBe(true);
      if (q.owner === "25999438") continue; // documented freestanding intervals
      const x = (v[0]+v[6])/2, z = (v[2]+v[8])/2, low = Math.min(v[1],v[7]), high = Math.max(v[1],v[7]);
      const axis = Math.max(...xs)-Math.min(...xs) < 1e-8 ? 0 : 1;
      const coordinate = axis === 0 ? x : z;
      expect(source.nativeCells.some(c => c[2] <= low + 1e-7 && c[3] >= high - 1e-7 &&
        Math.abs(Math.abs(coordinate - c[axis]) - source.nativeCellM/2) >= .025 &&
        Math.abs(Math.abs(coordinate - c[axis]) - source.nativeCellM/2) <= .331 &&
        Math.abs((axis === 0 ? z : x) - c[1-axis]) <= 4.4)).toBe(true);
    }
  });

  test("full mobile parity and bounded merged batches retain existing lifetime", () => {
    const full = createDiplomaticAndRobertKochDetails("full"), mobile = createDiplomaticAndRobertKochDetails("mobile");
    expect(staticGeometryAudit(mobile)).toEqual(staticGeometryAudit(full));
    disposeStaticAudit(full); disposeStaticAudit(mobile);
    for (const native of [false,true]) {
      const b = createBuilder(); addNordicAndKasV246(b, native);
      expect(b.parts).toHaveLength(1);
      const group = native ? createMinecraftNordicAndKasV246() : finishDrawnGroup(b,{name:"drawn audit"})!;
      const audit = staticGeometryAudit(group);
      expect(audit.budget.bytes).toBeLessThan(native ? 2.5*1024*1024 : 512*1024);
      const meshes: Mesh[] = [];group.traverse(o=>{if(o instanceof Mesh)meshes.push(o);});
      expect(meshes).toHaveLength(1);
      for (const mesh of meshes) expect(mesh.geometry.getAttribute("uv")).toBeUndefined();
      console.log("v246 Nordic/KAS",native?"native":"drawn",audit.budget);
      disposeStaticAudit(group);
      if(native) for(const part of b.parts)part.dispose();
    }
  });
});
