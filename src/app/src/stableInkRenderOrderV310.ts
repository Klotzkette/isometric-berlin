/** Exact renderer-authored ink order with a private source-identity witness. */
import type {BufferGeometry,LineBasicMaterial,LineSegments} from "three";
type Assignment={authored:number;base:number;assigned:number};
const assignments=new WeakMap<LineSegments,Assignment>();
/**
 * Lock transparent ink to a deterministic order inside its authored layer.
 *
 * Three.js otherwise falls back to camera-space depth for objects sharing a
 * renderOrder. Nearly co-planar facade and roof lines can exchange places
 * while orbiting, changing blended pixels even though their geometry is
 * static. The tiny rank stays inside the original layer and is independent of
 * the camera; object ids are stable for the lifetime of the scene.
 */
export const STABLE_INK_RENDER_ORDER_SPAN = 1e-4;

export function assignStableInkRenderOrder(
  lines: ReadonlyArray<LineSegments<BufferGeometry, LineBasicMaterial>>,
): void {
  const layers = new Map<
    number,
    Array<LineSegments<BufferGeometry, LineBasicMaterial>>
  >();
  for (const line of lines) {
    const storedOrder = line.userData.stableInkBaseRenderOrder;
    const baseOrder =
      typeof storedOrder === "number" && Number.isFinite(storedOrder)
        ? storedOrder
        : Number.isFinite(line.renderOrder)
          ? line.renderOrder
          : 0;
    const previous=assignments.get(line);
    assignments.set(line,{authored:previous?.authored??(Number.isFinite(line.renderOrder)?line.renderOrder:0),base:baseOrder,assigned:line.renderOrder});
    line.userData.stableInkBaseRenderOrder = baseOrder;
    const layer = layers.get(baseOrder) ?? [];
    layer.push(line);
    layers.set(baseOrder, layer);
  }
  for (const [baseOrder, layer] of layers) {
    layer.sort((left, right) => left.id - right.id);
    const denominator = layer.length + 1;
    layer.forEach((line, index) => {
      line.renderOrder =
        baseOrder + (STABLE_INK_RENDER_ORDER_SPAN * (index + 1)) / denominator;
      const proof=assignments.get(line)!;proof.assigned=line.renderOrder;
    });
  }
}


/** A source's exact authored order or this real renderer's latest assignment.
 * Public userData and cloned labels never create a private rank witness. */
export function hasAuthoredOrStableInkRenderOrderV310(line:LineSegments,authored:number):boolean{
 const proof=assignments.get(line);
 if(proof)return proof.authored===authored&&proof.base===authored&&line.renderOrder===proof.assigned;
 return line.renderOrder===authored&&!Object.hasOwn(line.userData,"stableInkBaseRenderOrder");
}
