import { BoxGeometry, Color, Group, InstancedMesh, Matrix4, MeshBasicMaterial, MeshStandardMaterial, Vector3 } from "three";
import source from "./data/ringStationsV232.json";
import { letteringLayout, letteringStrokePaths } from "./drawnLettering";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

type Vec = [number, number, number];
type Block = { matrix: number[]; color: number; station: string; sourceId: string; role: string };
const C = { ink: 0xe6e4d4, blue: 0x284764, steel: 0x66716c, ring: 0x73563c };
export const RING_STATIONS_V232_GROUP = "Ring station identity and open canopy fittings v232";
const nameLabel = (name: string) => name.replace(/ß/g, "SS").replace(/ä/g, "AE").replace(/ö/g, "OE").replace(/ü/g, "UE").replace(/\//g, " ").toUpperCase();

/** Constructor-only plan; source objects never escape into retained mesh metadata. */
export function planRingStationsV232(native = false): Block[] {
  const blocks: Block[] = [];
  const matrix = new Matrix4(), vx = new Vector3(), vy = new Vector3(), vz = new Vector3();
  for (const site of source.sites) {
    const emit = (center: Vec, size: Vec, yaw: number, color: number, role: string, sourceId = site.platform) => {
      if (native) matrix.makeScale(...size); else matrix.makeRotationY(yaw).scale(new Vector3(...size));
      matrix.setPosition(...center);
      blocks.push({ matrix: matrix.toArray(), color, station: site.name, sourceId, role });
    };
    const rod = (a: Vec, b: Vec, width: number, depth: number, normal: Vec, color: number, role: string, sourceId = site.platform) => {
      const length = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      if (length < .001) return;
      if (native) {
        // Independently axis-aligned surface-sized blocks, including lettering.
        const steps = Math.max(1, Math.ceil(length / (role.includes("letter") ? .055 : .45)));
        for (let i = 0; i < steps; i++) {
          const center = a.map((v, j) => v + (b[j] - v) * (i + .5) / steps) as Vec;
          const size = a.map((v, j) => Math.abs(b[j] - v) / steps + width) as Vec;
          emit(center, size, 0, color, role, sourceId);
        }
      } else {
        vx.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
        vz.set(...normal).normalize(); vy.crossVectors(vz, vx).normalize();
        matrix.makeBasis(vx, vy, vz).scale(new Vector3(length, width, depth)).setPosition(
          (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
        blocks.push({ matrix: matrix.toArray(), color, station: site.name, sourceId, role });
      }
    };
    const s = site.sign;
    const nativePlateExit = (u: number, side: number, width: number, depth: number, count: number) => {
      const x = s.x + s.dx * u * side, z = s.z + s.dz * u * side;
      const nx = -s.dz * side, nz = s.dx * side;
      let exit = 0;
      for (let i = 0; i < count; i++) {
        const t = ((i + .5) / count - .5) * width;
        const cx = s.x + s.dx * t, cz = s.z + s.dz * t;
        const hx = (Math.abs(s.dx) * width / count + Math.abs(s.dz) * depth) / 2;
        const hz = (Math.abs(s.dz) * width / count + Math.abs(s.dx) * depth) / 2;
        let lo = -Infinity, hi = Infinity;
        for (const [v, n, c, h] of [[x,nx,cx,hx],[z,nz,cz,hz]]) {
          if (Math.abs(n) < 1e-9) { if (Math.abs(v-c)>h) { hi=-Infinity; break; } }
          else { const a=(c-h-v)/n,b=(c+h-v)/n;lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b)); }
        }
        if (hi >= Math.max(0,lo)) exit = Math.max(exit,hi);
      }
      return exit + .038;
    };
    // v190 already has the complete board/posts/front text. Add only its blank
    // reverse face, mirrored in world-space so it reads normally from behind.
    const lettering = (label: string, cap: number, y: number, side: number, role: string, offset = .112) => {
      const normal: Vec = [-s.dz * side, 0, s.dx * side];
      const project = ([u, v]: number[]): Vec => [s.x + s.dx * u * side + normal[0] * offset,
        y + v, s.z + s.dz * u * side + normal[2] * offset];
      for (const path of letteringStrokePaths(label, cap)) for (let i = 1; i < path.length; i++) {
        if (!native) rod(project(path[i - 1]), project(path[i]), .045, .028, normal, C.ink, role);
        else {
          // The old native board is a staircase of 1.6m axis-aligned pieces.
          // Follow its actual outside boundary, not an imaginary rotated plane.
          const a=path[i-1],b=path[i],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.055));
          const width=role.startsWith("reverse")?letteringLayout(label,cap).totalWidthM+.6:2.15;
          const count=role.startsWith("reverse")?Math.ceil(width/1.6):6;
          for(let j=0;j<n;j++) {
            const u=a[0]+(b[0]-a[0])*(j+.5)/n,v=a[1]+(b[1]-a[1])*(j+.5)/n;
            const out=nativePlateExit(u,side,width,role.startsWith("reverse")?.16:.10,count);
            emit([s.x+s.dx*u*side+normal[0]*out,y+v,s.z+s.dz*u*side+normal[2]*out],
              [.052,.052,.052],0,C.ink,role);
          }
        }
      }
    };
    lettering(nameLabel(site.name), .32, s.y + 2.5, -1, "reverse name lettering");
    // A small shared Ring identity below the retained name board. These are
    // line identities, not invented live departure times or directional arrows.
    if (native) {
      const n = 6, yaw = -Math.atan2(s.dz, s.dx);
      for (let i = 0; i < n; i++) {
        const u = ((i + .5) / n - .5) * 2.15;
        emit([s.x + s.dx * u, s.y + 2.08, s.z + s.dz * u],
          [Math.abs(Math.cos(yaw)) * 2.15 / n + Math.abs(Math.sin(yaw)) * .10,
            .38, Math.abs(Math.sin(yaw)) * 2.15 / n + Math.abs(Math.cos(yaw)) * .10], 0, C.ring, "Ring identity strip");
      }
    } else emit([s.x, s.y + 2.08, s.z], [2.15, .38, .10], -Math.atan2(s.dz, s.dx), C.ring, "Ring identity strip");
    for (const side of [-1, 1]) lettering("S41 S42", .23, s.y + 1.965, side, "Ring identity lettering", native ? .14 : .075);
    for (const canopy of site.canopies) {
      const bottom = canopy.floor, top = canopy.top;
      for (const [x, z] of canopy.posts) {
        emit([x, (bottom + top - .16) / 2, z], [.15, top - bottom - .16, .15], 0, C.steel, "open canopy support", canopy.id);
        emit([x, bottom + .06, z], [.34, .12, .34], 0, C.steel, "support foot", canopy.id);
      }
      for (const [a, b] of canopy.cross) {
        // The existing cap remains untouched. Members fit wholly below it.
        rod([a[0], top - .18, a[1]], [b[0], top - .18, b[1]], .18, .12,
          [0, 1, 0], C.steel, "source-clipped canopy cross member", canopy.id);
      }
    }
  }
  return blocks;
}

export function createRingStationsV232(native = false): Group {
  const root = new Group(); root.name = RING_STATIONS_V232_GROUP;
  root.userData = { ringStationsV232: true, auditedStationCount: 27, refinedStationCount: 22,
    fullStaticDetailOnTouch: true, textureFree: true, nativeMinecraft: native,
    blockNative: native, keepInMinecraft: native, additiveOnly: true };
  const plan = planRingStationsV232(native);
  const geometry = new BoxGeometry(1, 1, 1); geometry.deleteAttribute("uv");
  const day = new MeshBasicMaterial({ color: 0xffffff });
  const night = new MeshStandardMaterial({ color: 0xffffff, roughness: .88 });
  const matrix = new Matrix4(), color = new Color();
  for (const station of new Set(plan.map(b => b.station))) {
    const blocks = plan.filter(b => b.station === station);
    const mesh = new InstancedMesh(geometry, day, blocks.length);
    blocks.forEach((block, i) => { mesh.setMatrixAt(i, matrix.fromArray(block.matrix)); mesh.setColorAt(i, color.setHex(block.color)); });
    mesh.name = `Ring v232 ${station}`;
    mesh.userData = { dayMaterial: day, nightMaterial: night, stationName: station,
      textureFree: true, blockNative: native, keepInMinecraft: native };
    mesh.computeBoundingBox(); mesh.computeBoundingSphere(); root.add(mesh);
  }
  return freezeStaticSceneTransforms(root);
}
