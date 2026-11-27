import { expect, test } from "bun:test";
import { deferredCanvasTexture, unpaintedCanvas } from "../src/deferredCanvasTexture";

test("an offscreen canvas stays small through cloning, replacement and retirement", () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "document");
  let paints = 0;
  const canvas = { width: 0, height: 0, getContext: () => ({}) };
  Object.defineProperty(globalThis, "document", { configurable: true, value: { createElement: () => canvas } });
  try {
    const create = () => deferredCanvasTexture(1317, 241, () => { paints++; })!;
    const texture = create();
    const clone = texture.clone();
    expect([canvas.width, canvas.height, paints]).toEqual([1, 1, 0]);
    expect(unpaintedCanvas(clone)).toBe(true);
    texture.dispose();
    expect(paints).toBe(0);
    expect(clone.image).toBe(canvas as unknown as HTMLCanvasElement);
    expect([canvas.width, canvas.height, paints]).toEqual([1317, 241, 1]);
    expect(unpaintedCanvas(texture)).toBe(false);
    expect(texture.image).toBe(clone.image);
    expect(paints).toBe(1);
    const replacement = create();
    const other = {} as HTMLCanvasElement;
    replacement.image = other;
    expect(replacement.image).toBe(other);
    expect(unpaintedCanvas(replacement)).toBe(false);
    expect(paints).toBe(1);
    clone.dispose();
    replacement.dispose();
  } finally {
    if (previous) Object.defineProperty(globalThis, "document", previous);
    else Reflect.deleteProperty(globalThis, "document");
  }
});
