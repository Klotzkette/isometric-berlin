import { type BufferGeometry, type LineBasicMaterial, type LineSegments, type PerspectiveCamera, Vector3 } from "three";
import { inkLineFadeOpacity } from "./fineDetailFade";

type Ink = LineSegments<BufferGeometry, LineBasicMaterial>;

export function createQuadrigaInkTarget(line: Ink) {
  if (!line.geometry.boundingSphere) line.geometry.computeBoundingSphere();
  const centre = line.localToWorld(line.geometry.boundingSphere!.center.clone());
  return { line, centre, viewPoint: new Vector3(), opacity: Number.NaN };
}

/** The median of the 5,132 authored bronze outline segments is 0.134 m.
 * Use their projected size in the actual drawing buffer. The bronze surfaces
 * and their colour-defined silhouette remain visible at every resolution. */
export function updateQuadrigaInkProjection(
  target: ReturnType<typeof createQuadrigaInkTarget>, camera: PerspectiveCamera, bufferHeight: number,
): boolean {
  const depth = -camera.worldToLocal(target.viewPoint.copy(target.centre)).z;
  const size = depth > 0 ? 0.134 * camera.projectionMatrix.elements[5] * bufferHeight / (2 * depth) : 0;
  const opacity = inkLineFadeOpacity(size);
  if (opacity === target.opacity) return false;
  target.opacity = opacity;
  return true;
}
