import { CanvasTexture, type Source, type Texture } from "three";

const awaitingPaint = new WeakSet<Source<unknown>>();

/** Retirement must not paint an off-screen sign just to check for ImageBitmap.close(). */
export function unpaintedCanvas(texture: Texture): boolean {
  return awaitingPaint.has(texture.source);
}

/** Keep a full-resolution procedural canvas out of memory until Three or a
 * compositor first reads its pixels. Texture clones share the same Source. */
export function deferredCanvasTexture(
  width: number,
  height: number,
  paint: (context: CanvasRenderingContext2D) => void,
): CanvasTexture | null {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const context = canvas.getContext("2d");
  if (!context) return null;

  const texture = new CanvasTexture(canvas);
  const source = texture.source;
  const publish = (value: unknown) => {
    Object.defineProperty(source, "data", { configurable: true, enumerable: true, writable: true, value });
    awaitingPaint.delete(source);
  };
  awaitingPaint.add(source);
  Object.defineProperty(source, "data", {
    configurable: true, enumerable: true,
    get() {
      canvas.width = width;
      canvas.height = height;
      paint(context);
      publish(canvas);
      return canvas;
    },
    // Preserve Texture.image replacement, including before the first upload.
    set: publish,
  });
  return texture;
}
